from flask import Flask, render_template, request, jsonify, session
from flask_mysqldb import MySQL
import hashlib

app = Flask(__name__)

# --- Configurations ---
app.secret_key = 'your_super_secure_session_encryption_key'
app.config['MYSQL_HOST'] = 'localhost'
app.config['MYSQL_USER'] = 'root'
app.config['MYSQL_PASSWORD'] = 'root'  # Replace with your actual MySQL password
app.config['MYSQL_DB'] = 'student_crud'

mysql = MySQL(app)

def hash_text(text):
    return hashlib.sha256(text.strip().lower().encode()).hexdigest()

@app.route('/')
def index():
    return render_template('index.html')

# --- AUTH API: SIGNUP ---
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        question = data.get('question')
        answer = data.get('answer')
        
        if not all([username, password, question, answer]):
            return jsonify({"error": "All fields are mandatory!"}), 400
            
        cur = mysql.connection.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s", (username,))
        if cur.fetchone():
            cur.close()
            return jsonify({"error": "Username is already taken!"}), 400
            
        pass_hashed = hash_text(password)
        ans_hashed = hash_text(answer)
        
        cur.execute("""INSERT INTO users (username, password_hash, recovery_question, recovery_answer_hash) 
                       VALUES (%s, %s, %s, %s)""", (username, pass_hashed, question, ans_hashed))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Account registered successfully! Now log in."}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AUTH API: LOGIN ---
@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.json
        username = data.get('username')
        password = data.get('password')
        hashed_pass = hash_text(password)
        
        cur = mysql.connection.cursor()
        cur.execute("SELECT id, username FROM users WHERE username = %s AND password_hash = %s", (username, hashed_pass))
        user = cur.fetchone()
        cur.close()
        
        if user:
            session['user_id'] = user[0]
            session['username'] = user[1]
            return jsonify({"message": "Access granted!", "username": user[1]}), 200
        return jsonify({"error": "Invalid username or password!"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AUTH API: FETCH RECOVERY QUESTION ---
@app.route('/api/auth/get-question', methods=['POST'])
def get_question():
    data = request.json
    username = data.get('username')
    cur = mysql.connection.cursor()
    cur.execute("SELECT recovery_question FROM users WHERE username = %s", (username,))
    row = cur.fetchone()
    cur.close()
    if row:
        return jsonify({"question": row[0]}), 200
    return jsonify({"error": "User profile not found!"}), 404

# --- AUTH API: RESET PASSWORD VIA RECOVERY ---
@app.route('/api/auth/reset-password', methods=['POST'])
def reset_password():
    try:
        data = request.json
        username = data.get('username')
        answer = data.get('answer')
        new_password = data.get('newPassword')
        
        ans_hashed = hash_text(answer)
        new_pass_hashed = hash_text(new_password)
        
        cur = mysql.connection.cursor()
        cur.execute("SELECT id FROM users WHERE username = %s AND recovery_answer_hash = %s", (username, ans_hashed))
        user = cur.fetchone()
        
        if not user:
            cur.close()
            return jsonify({"error": "Incorrect recovery security answer!"}), 401
            
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_pass_hashed, user[0]))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Password updated successfully! Please log in now."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AUTH API: USER CONTROLLED CHANGE PASSWORD (INSIDE APP) ---
@app.route('/api/auth/change-password', methods=['POST'])
def change_password():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized session context!"}), 401
    try:
        data = request.json
        old_pass = data.get('oldPassword')
        new_pass = data.get('newPassword')
        
        old_hashed = hash_text(old_pass)
        new_hashed = hash_text(new_pass)
        
        cur = mysql.connection.cursor()
        cur.execute("SELECT password_hash FROM users WHERE id = %s", (session['user_id'],))
        current_hash = cur.fetchone()[0]
        
        if current_hash != old_hashed:
            cur.close()
            return jsonify({"error": "Current password does not match!"}), 400
            
        cur.execute("UPDATE users SET password_hash = %s WHERE id = %s", (new_hashed, session['user_id']))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Password updated successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AUTH API: LOGOUT ---
@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."}), 200

# --- DATA API: READ ALL ---
@app.route('/api/students', methods=['GET'])
def get_students():
    if 'user_id' not in session:
        return jsonify({"error": "Please log in first"}), 401
    try:
        cur = mysql.connection.cursor()
        cur.execute("SELECT * FROM students ORDER BY id DESC")
        rows = cur.fetchall()
        cur.close()
        students = []
        for row in rows:
            students.append({
                "id": row[0], "fName": row[1], "lName": row[2], "rollNo": row[3],
                "branch": row[4], "batchNo": row[5], "domain": row[6],
                "submissionDate": str(row[7]), "status": row[8], "email": row[9],
                "phone": row[10], "guide": row[11]
            })
        return jsonify(students), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- DATA API: CREATE ---
@app.route('/api/students', methods=['POST'])
def add_student():
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        data = request.json
        cur = mysql.connection.cursor()
        query = """INSERT INTO students (fName, lName, rollNo, branch, batchNo, domain, submissionDate, status, email, phone, guide) 
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)"""
        cur.execute(query, (
            data['fName'], data['lName'], data['rollNo'], data['branch'], 
            data['batchNo'], data['domain'], data['submissionDate'], 
            data['status'], data['email'], data['phone'], data['guide']
        ))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Data saved to database successfully!"}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- DATA API: UPDATE ---
@app.route('/api/students/<int:id>', methods=['PUT'])
def update_student(id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        data = request.json
        cur = mysql.connection.cursor()
        query = """UPDATE students SET fName=%s, lName=%s, rollNo=%s, branch=%s, batchNo=%s, 
                   domain=%s, submissionDate=%s, status=%s, email=%s, phone=%s, guide=%s WHERE id=%s"""
        cur.execute(query, (
            data['fName'], data['lName'], data['rollNo'], data['branch'], 
            data['batchNo'], data['domain'], data['submissionDate'], 
            data['status'], data['email'], data['phone'], data['guide'], id
        ))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Student record updated successfully!"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- DATA API: DELETE ---
@app.route('/api/students/<int:id>', methods=['DELETE'])
def delete_student(id):
    if 'user_id' not in session:
        return jsonify({"error": "Unauthorized"}), 401
    try:
        cur = mysql.connection.cursor()
        cur.execute("DELETE FROM students WHERE id = %s", (id,))
        mysql.connection.commit()
        cur.close()
        return jsonify({"message": "Record dropped from database completely."}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)