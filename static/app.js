// --- DOM CORE VIEW WINDOW SELECTIONS ---
const authScreen = document.getElementById("authScreen"),
      loginCard = document.getElementById("loginCard"),
      signupCard = document.getElementById("signupCard"),
      forgotCard = document.getElementById("forgotCard"),
      landingView = document.getElementById("landingView"),
      crudApp = document.getElementById("crudApp");

// --- MODAL LAYER INTERACTION SPECIFICS ---
const crudFormModal = document.getElementById("crudFormModal"),
      changePassModal = document.getElementById("changePassModal");

// --- ADDITIONAL DOM SELECTIONS FOR CRUD ENGINE ---
const userInfo = document.querySelector(".userInfo"),
      entries = document.querySelector(".showEntries"),
      search = document.getElementById("search"),
      table_size = document.getElementById("table_size");


// --- INTERFACE TO AUTH CARD LINK ROUTERS ---
document.getElementById("toSignupLink").addEventListener("click", (e) => { e.preventDefault(); loginCard.style.display="none"; signupCard.style.display="block"; });
document.getElementById("toForgotLink").addEventListener("click", (e) => { e.preventDefault(); loginCard.style.display="none"; forgotCard.style.display="block"; });
document.querySelectorAll(".backToLoginLink").forEach(link => {
    link.addEventListener("click", (e) => { e.preventDefault(); signupCard.style.display="none"; forgotCard.style.display="none"; loginCard.style.display="block"; });
});

// --- CLIENT SIDE STATE TRACKERS ---
let originalData = [];
let getData = [];
let isEdit = false, editId;
var arrayLength = 0, tableSize = 10, startIndex = 1, endIndex = 0, currentIndex = 1, maxIndex = 0;

// ==================== SECURITY MODULE TRANSACTIONS ====================

// SIGNUP SUBMISSION
document.getElementById("signupForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("regUser").value;
    const password = document.getElementById("regPass").value;
    const question = document.getElementById("regQuestion").value;
    const answer = document.getElementById("regAnswer").value;

    fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, question, answer })
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(resObj => {
        alert(resObj.body.message || resObj.body.error);
        if (resObj.status === 201) {
            document.getElementById("signupForm").reset();
            loginCard.style.display="block"; signupCard.style.display="none";
        }
    });
});

// LOGIN SUBMISSION
document.getElementById("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("loginUser").value;
    const password = document.getElementById("loginPass").value;

    fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(resObj => {
        if (resObj.status === 200) {
            document.getElementById("loginForm").reset();
            authScreen.style.display = "none";
            landingView.style.display = "flex";
            document.getElementById("displayUsername").innerText = resObj.body.username;
        } else {
            alert(resObj.body.error);
        }
    });
});

// FORGOT PASSWORD STEP 1: FETCH QUESTION
document.getElementById("usernameVerifyForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("forgotUser").value;
    fetch('/api/auth/get-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(resObj => {
        if(resObj.status === 200) {
            document.getElementById("questionDisplay").innerText = "Security Question: " + resObj.body.question;
            document.getElementById("recoveryVerificationForm").style.display = "block";
        } else {
            alert(resObj.body.error);
        }
    });
});

// FORGOT PASSWORD STEP 2: VERIFY AND SUBMIT RESET
document.getElementById("recoveryVerificationForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const username = document.getElementById("forgotUser").value;
    const answer = document.getElementById("forgotAnswer").value;
    const newPassword = document.getElementById("forgotNewPass").value;

    fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, answer, newPassword })
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(resObj => {
        alert(resObj.body.message || resObj.body.error);
        if (resObj.status === 200) {
            document.getElementById("usernameVerifyForm").reset();
            document.getElementById("recoveryVerificationForm").reset();
            document.getElementById("recoveryVerificationForm").style.display = "none";
            forgotCard.style.display = "none"; loginCard.style.display = "block";
        }
    });
});

// PROFILE ACCOUNT PANEL: CHANGE PASSWORD
document.getElementById("openChangePassModalBtn").addEventListener("click", () => { changePassModal.classList.add("active"); });
document.getElementById("closeChangePassModalBtn").addEventListener("click", () => { changePassModal.classList.remove("active"); });
document.getElementById("changePasswordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById("oldProfilePass").value;
    const newPassword = document.getElementById("newProfilePass").value;

    fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldPassword, newPassword })
    })
    .then(res => res.json().then(data => ({ status: res.status, body: data })))
    .then(resObj => {
        alert(resObj.body.message || resObj.body.error);
        if(resObj.status === 200) {
            document.getElementById("changePasswordForm").reset();
            changePassModal.classList.remove("active");
        }
    });
});

// SYSTEM LOGOUT ACTIONS
document.querySelectorAll(".globalLogout").forEach(btn => {
    btn.addEventListener("click", () => {
        fetch('/api/auth/logout', { method: 'POST' }).then(() => {
            crudApp.style.display = "none";
            landingView.style.display = "none";
            authScreen.style.display = "flex";
            loginCard.style.display = "block"; signupCard.style.display = "none"; forgotCard.style.display = "none";
        });
    });
});


// ==================== ASYNCHRONOUS CRUD ENGINE ====================

function loadDataFromServer() {
    fetch('/api/students')
        .then(res => {
            if (res.status === 401) {
                alert("Session expired. Please log in.");
                authScreen.style.display = "flex"; landingView.style.display = "none"; crudApp.style.display = "none";
                throw new Error("Unauthorized");
            }
            return res.json();
        })
        .then(data => {
            originalData = data;
            getData = [...originalData];
            preLoadCalculations();
            highlightIndexBtn();
            displayIndexBtn();
            showInfo();
        }).catch(err => console.log(err));
}

// TOGGLE VIEW ROUTERS
document.querySelector('.addMemberBtn').addEventListener('click', () => {
    isEdit = false;
    document.getElementById("myForm").reset();
    document.querySelector('.submitBtn').innerHTML = "Submit";
    document.querySelector('.modalTitle').innerHTML = "Fill the Form";
    document.querySelector('.popupFooter').style.display = "block";
    document.querySelectorAll('#myForm input').forEach(inp => inp.disabled = false);
    crudFormModal.classList.add('active');
});

document.getElementById("closeCrudModalBtn").addEventListener('click', () => { crudFormModal.classList.remove('active'); });

document.getElementById("existingUserBtn").addEventListener("click", () => {
    landingView.style.display = "none";
    crudApp.style.display = "block";
    loadDataFromServer();
});

document.getElementById("goBackBtn").addEventListener("click", () => {
    landingView.style.display = "flex";
    crudApp.style.display = "none";
});

// CORE CALCULATIONS & PAGINATION
function preLoadCalculations(){ arrayLength = getData.length; maxIndex = Math.ceil(arrayLength / tableSize); }

function displayIndexBtn(){
    preLoadCalculations();
    const pagination = document.querySelector('.pagination');
    pagination.innerHTML = '<button onclick="prev()" class="prev">Previous</button>';
    for(let i=1; i<=maxIndex; i++){ pagination.innerHTML += `<button onclick="paginationBtn(${i})" index="${i}">${i}</button>`; }
    pagination.innerHTML += '<button onclick="next()" class="next">Next</button>';
    highlightIndexBtn();
}

function highlightIndexBtn(){
    startIndex = arrayLength > 0 ? ((currentIndex - 1) * tableSize) + 1 : 0;
    endIndex = (startIndex + tableSize) - 1;
    if(endIndex > arrayLength) endIndex = arrayLength;

    let prevBtn = document.querySelector(".prev");
    let nextBtn = document.querySelector(".next");
    
    if(prevBtn) {
        if(currentIndex > 1) {
            prevBtn.classList.add("act");
        } else {
            prevBtn.classList.remove("act");
        }
    }
    
    if(nextBtn) {
        if(currentIndex < maxIndex) {
            nextBtn.classList.add("act");
        } else {
            nextBtn.classList.remove("act");
        }
    }

    if(entries) entries.textContent = `Showing ${startIndex} to ${endIndex} of ${arrayLength} entries`;

    document.querySelectorAll('.pagination button').forEach(btn => {
        btn.classList.remove('active');
        if(btn.getAttribute('index') === currentIndex.toString()) btn.classList.add('active');
    });
    showInfo();
}

function showInfo(){
    userInfo.innerHTML = "";
    let tab_start = startIndex - 1, tab_end = endIndex;

    if(getData.length > 0){
        for(let i=tab_start; i<tab_end; i++){
            let staff = getData[i];
            if(staff){
                userInfo.innerHTML += `<tr class="employeeDetails">
                <td>${i+1}</td><td>${staff.fName} ${staff.lName}</td><td>${staff.rollNo}</td><td>${staff.branch}</td>
                <td>${staff.batchNo}</td><td>${staff.domain}</td><td>${staff.submissionDate}</td><td>${staff.status}</td>
                <td>${staff.email}</td><td>${staff.phone}</td><td>${staff.guide}</td>
                <td>
                    <button onclick="readInfo('${staff.fName}', '${staff.lName}', '${staff.rollNo}', '${staff.branch}', '${staff.batchNo}', '${staff.domain}', '${staff.submissionDate}','${staff.status}','${staff.email}', '${staff.phone}','${staff.guide}')"><i class="fa-regular fa-eye"></i></button>
                    <button onclick="editInfo('${i}','${staff.fName}', '${staff.lName}', '${staff.rollNo}', '${staff.branch}', '${staff.batchNo}', '${staff.domain}', '${staff.submissionDate}','${staff.status}','${staff.email}', '${staff.phone}','${staff.guide}')"><i class="fa-regular fa-pen-to-square"></i></button>
                    <button onclick="deleteInfo(${i})"><i class="fa-regular fa-trash-can"></i></button>
                </td></tr>`;
            }
        }
    } else {
        userInfo.innerHTML = `<tr class="employeeDetails"><td colspan="12" align="center">No data available in table</td></tr>`;
    }
}

function readInfo(fname, lname, roll, br, batch, dom, SDate, Stat, Email, Phone, Guide){
    document.getElementById("fName").value = fname; document.getElementById("lName").value = lname; document.getElementById("rollNo").value = roll; document.getElementById("branch").value = br;
    document.getElementById("batchNo").value = batch; document.getElementById("domain").value = dom; document.getElementById("sDate").value = SDate;
    document.getElementById("stat").value = Stat; document.getElementById("email").value = Email; document.getElementById("phone").value = Phone; document.getElementById("guide").value = Guide;
    crudFormModal.classList.add('active'); document.querySelector('.popupFooter').style.display = "none"; document.querySelector('.modalTitle').innerHTML = "Profile";
    document.querySelectorAll('#myForm input').forEach(input => input.disabled = true);
}

function editInfo(index, fname, lname, roll, br, batch, dom, SDate, Stat, Email, Phone, Guide){
    isEdit = true; editId = index;
    document.getElementById("fName").value = fname; document.getElementById("lName").value = lname; document.getElementById("rollNo").value = roll; document.getElementById("branch").value = br;
    document.getElementById("batchNo").value = batch; document.getElementById("domain").value = dom; document.getElementById("sDate").value = SDate;
    document.getElementById("stat").value = Stat; document.getElementById("email").value = Email; document.getElementById("phone").value = Phone; document.getElementById("guide").value = Guide;
    crudFormModal.classList.add('active'); document.querySelector('.popupFooter').style.display = "block"; document.querySelector('.modalTitle').innerHTML = "Update the Form";
    document.querySelector('.submitBtn').innerHTML = "Update"; document.querySelectorAll('#myForm input').forEach(input => input.disabled = false);
}

function deleteInfo(index){
    if(confirm("Are you sure want to drop this record completely?")){
        fetch(`/api/students/${getData[index].id}`, { method: 'DELETE' })
        .then(res => res.json()).then(data => { alert(data.message); loadDataFromServer(); });
    }
}

// HANDLE CRUD FORM WRITE SUBMISSION
document.getElementById("myForm").addEventListener('submit', (e) => {
    e.preventDefault();

    let Phone = document.getElementById("phone").value;
    let emailVal = document.getElementById("email").value;
    if (!/^[0-9]{10}$/.test(Phone) || !/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(emailVal)) {
        alert("Invalid Email or Phone Number format validation rules!");
        return;
    }

    const information = {
        fName: document.getElementById("fName").value, lName: document.getElementById("lName").value, rollNo: document.getElementById("rollNo").value, branch: document.getElementById("branch").value,
        batchNo: document.getElementById("batchNo").value, domain: document.getElementById("domain").value, submissionDate: document.getElementById("sDate").value,
        status: document.getElementById("stat").value, email: emailVal, phone: Phone, guide: document.getElementById("guide").value
    };

    let url = '/api/students', method = 'POST';
    if(isEdit){ url = `/api/students/${getData[editId].id}`; method = 'PUT'; }

    fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(information)
    })
    .then(res => res.json())
    .then(data => {
        alert(data.message || "Operation Completed!");
        crudFormModal.classList.remove('active');
        document.getElementById("myForm").reset();
        loadDataFromServer();
    });
});

// SEARCH FILTER HANDLE
if(search) {
    search.addEventListener("input", () => {
        let val = search.value.toLowerCase().trim();
        getData = originalData.filter(item => 
            item.fName.toLowerCase().includes(val) || 
            item.lName.toLowerCase().includes(val) || 
            item.rollNo.toLowerCase().includes(val) ||
            item.domain.toLowerCase().includes(val)
        );
        currentIndex = 1; displayIndexBtn();
    });
}

// COMPLEMENTARY NAV ROUTERS
function next(){ if(currentIndex <= maxIndex - 1){ currentIndex++; highlightIndexBtn(); } }
function prev(){ if(currentIndex > 1){ currentIndex--; highlightIndexBtn(); } }
function paginationBtn(i){ currentIndex = i; highlightIndexBtn(); }
if(table_size) { table_size.addEventListener('change', ()=>{ tableSize = parseInt(table_size.value); currentIndex = 1; displayIndexBtn(); }); }