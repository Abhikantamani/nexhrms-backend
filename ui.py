import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from groq import Groq

# ── CONFIG ─────────────────────────────────────────────────────────
COMPANY_NAME = "Future Invo Solutions"
PRODUCT_NAME = "NexHRMS"
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")

GROQ_MODELS = [
    "llama-3.3-70b-versatile",
    "llama-3.1-8b-instant",
]

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"],
                   allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

# ── WEBSITE KNOWLEDGE BASE ─────────────────────────────────────────
WEBSITE_GUIDE = """
NEXHRMS WEBSITE - COMPLETE NAVIGATION GUIDE
===========================================

PUBLIC PAGES (no login needed):
/home, /features, /about, /contact, /docs
/assets, /employees, /leaves, /payroll
/feature/attendance, /feature/onboarding, /privacy-policy

AUTH PAGES:
/login         - Login with email+password or Google/Outlook SSO
/signup        - New account registration
/signup-otp    - OTP verification during signup
/forgot-password - Enter email to get reset OTP
/reset-password  - Set new password after OTP

ROLES: superadmin, admin, manager, hr, accountant, employee, newuser

════════════════════════════════════
SUPER ADMIN
════════════════════════════════════
Dashboard: /superadmin-dashboard
Pages:
- /companies          → Add/edit/delete companies in the system
- /users              → Manage all users, assign roles, deactivate accounts
- /super-admin/audit-logs → Full system activity logs
- /automation-center  → Configure automated workflows
- /branches           → Manage office branches
- /departments        → Manage departments
- /financial-reports  → Company-wide financial reports
- /setup-organization → Initial organization setup wizard

════════════════════════════════════
ADMIN
════════════════════════════════════
Dashboard: /admin-dashboard
Pages:
- /admin/audit-logs       → Activity logs
- /branches               → Manage branches
- /departments            → Manage departments
- /designations           → Manage job designations
- /employee-directory     → Full employee list
- /payroll-management     → Payroll overview
- /financial-reports      → Financial reports
- /automation-center      → Automated workflows
- /delegation             → Authority delegation
- /daily-task             → Task management
- /reports                → Generate reports
- /helpdesk               → Support tickets

HOW TO USE:
→ Login → lands on /admin-dashboard automatically
→ Use left sidebar to navigate to any section
→ Top bar: search, notifications bell, profile menu

════════════════════════════════════
MANAGER
════════════════════════════════════
Dashboard: /manager-dashboard
Pages:
- /team-members           → View all team members
- /my-team                → Squad/team overview
- /team-attendance        → Team daily attendance
- /leave-approvals        → Approve or reject team leaves
- /leave-requests         → All team leave requests
- /performance-feedback   → Give team performance feedback
- /performance            → Performance reviews
- /goals                  → Team goals and targets
- /projects               → Team projects
- /team-reports           → Team activity reports
- /wfh-requests           → Work From Home requests
- /daily-task             → Daily task management
- /calendar               → Team calendar
- /delegation             → Delegate tasks
- /payroll-processing     → Team payroll
- /salary-structure       → Salary structures

HOW TO APPROVE LEAVES:
1. Go to /leave-approvals
2. See list of pending requests (name, leave type, dates)
3. Click Approve or Reject on each
4. Optionally add comments
5. Employee gets notified automatically

HOW TO VIEW TEAM ATTENDANCE:
1. Go to /team-attendance
2. See today's status per member (Present/Absent/Late)
3. Filter by date, member, or status
4. Export report if needed

HOW TO MANAGE SQUAD:
1. Go to /my-team or /dashboard/manage-squad
2. View squad members and their roles
3. Click /dashboard/build-squad to create a new squad
4. View squad details at /dashboard/squad-details/:id

════════════════════════════════════
HR
════════════════════════════════════
Dashboard: /hr-dashboard
Pages:
- /employee-directory     → Search and view all employees
- /add-member             → Add new employee manually
- /invite-member          → Send email invite to new employee
- /create-username        → Create login credentials for employee
- /roles-list             → View all roles and permissions
- /onboarding             → New employee onboarding checklists
- /leave-management       → All company leave requests
- /leave-requests         → Pending leave requests
- /attendance             → Company-wide attendance
- /wfh-requests           → Work From Home requests
- /recruitment            → Job postings and applicant tracking
- /training               → Training programs
- /performance-reviews    → Company performance reviews
- /documents              → Company document management
- /departments            → Manage departments
- /branches               → Manage branches
- /helpdesk               → Support tickets
- /payroll-management     → Payroll overview

HOW TO ADD A NEW EMPLOYEE:
1. Go to /add-member
2. Fill in: Full Name, Email, Department, Designation, Role, Joining Date
3. Click Save
4. Then go to /create-username to set their login
5. OR go to /invite-member to email them a self-registration link

HOW TO MANAGE ONBOARDING:
1. Go to /onboarding
2. See new joiners and their progress
3. Assign tasks: document upload, training sessions, intro meetings
4. Track completion status per employee

HOW TO MANAGE RECRUITMENT:
1. Go to /recruitment
2. Create job postings with role, dept, requirements
3. View applicants and their stage
4. Move through: Applied → Shortlisted → Interview → Offer → Hired

════════════════════════════════════
EMPLOYEE
════════════════════════════════════
Dashboard: /employee-dashboard
Pages:
- /my-leaves              → View leave history and apply for leave
- /my-attendance          → Your personal attendance records
- /my-payslips            → View and download salary payslips
- /my-documents           → Personal documents (upload/view)
- /my-performance         → Your performance reviews
- /my-assets              → Company assets assigned to you
- /my-activity            → Your activity history
- /profile                → View and edit your profile
- /wfh-requests           → Submit Work From Home request
- /calendar               → Company calendar with holidays/events
- /visitors               → Register a visitor
- /desk-management        → Book a desk/seat
- /helpdesk               → Raise a support ticket
- /support                → Submit support request
- /knowledge-base         → Company knowledge articles
- /feedback               → Submit feedback
- /notifications          → All your notifications
- /change-password        → Change your password
- /settings               → Account settings

HOW TO APPLY FOR LEAVE:
1. Go to /my-leaves
2. Click "Apply Leave" button (top right)
3. Select Leave Type: Casual / Sick / Earned / Maternity / Paternity
4. Choose Start Date and End Date from calendar
5. Enter reason (optional)
6. Click Submit
7. Your manager gets notified — you'll be notified of the decision

HOW TO VIEW PAYSLIPS:
1. Go to /my-payslips
2. See list by month
3. Click any month to view breakdown
4. Click Download to save as PDF

HOW TO UPDATE YOUR PROFILE:
1. Go to /profile
2. Click Edit button
3. Update: phone, address, emergency contact, skills, bio
4. Click the avatar to upload a profile photo
5. Click Save Changes

HOW TO RAISE A SUPPORT TICKET:
1. Go to /helpdesk or /support
2. Click New Ticket
3. Select category: IT / HR / Admin / Finance
4. Describe your issue in detail
5. Submit — you get a ticket ID
6. Track status in the same section

HOW TO SUBMIT WFH REQUEST:
1. Go to /wfh-requests
2. Click New Request
3. Select date(s) for WFH
4. Add reason
5. Submit — manager gets notified

════════════════════════════════════
ACCOUNTANT
════════════════════════════════════
Dashboard: /payroll-dashboard (or /dashboard/accountant)
Pages:
- /payroll-dashboard      → Payroll overview and status
- /payslips               → Generate/manage payslips
- /payroll-processing     → Run monthly payroll
- /salary-structure       → Salary components configuration
- /invoices               → Company invoices
- /expenses               → Employee expense claims
- /tax-deductions         → Tax configuration
- /travel-expenses        → Travel expense approvals
- /loans                  → Employee loans
- /financial-reports      → Financial reports

HOW TO PROCESS PAYROLL:
1. Go to /payroll-processing
2. Select the month/period
3. System auto-calculates based on attendance and leaves
4. Review adjustments and deductions
5. Click Process Payroll
6. Review the summary page
7. Click Confirm & Generate to create all payslips

════════════════════════════════════
NEW USER
════════════════════════════════════
Dashboard: /welcome
Pages:
- /welcome                → Welcome screen with guided next steps
- /complete-profile       → Fill in your personal details
- /upload-documents       → Upload required documents (Aadhaar, PAN, certificates)
- /policies               → Read and acknowledge company policies
- /knowledge-base         → Browse company articles

HOW TO GET STARTED AS NEW USER:
1. You'll receive an email invite from HR with a login link
2. Click the link → set your password → you're logged in
3. You land on /welcome — follow the steps shown
4. Step 1: Complete your profile at /complete-profile
5. Step 2: Upload documents at /upload-documents (Aadhaar, PAN, Photo, Certificates)
6. Step 3: Read policies at /policies
7. Once HR reviews and approves, your role upgrades to Employee

════════════════════════════════════
COMMON FEATURES (ALL ROLES)
════════════════════════════════════
- Notifications: Bell icon (top right) → /notifications
- Search: Search bar (top center) → finds employees, pages, anything
- Profile Menu: Avatar (top right) → Profile, Settings, Change Password, Logout
- Settings: /settings → notifications, theme, privacy preferences
- Dark/Light Mode: Toggle in /settings or top bar
- Knowledge Base: /knowledge-base → guides and articles
- Feedback: /feedback → submit system feedback

════════════════════════════════════
LOGIN & AUTH
════════════════════════════════════
HOW TO LOGIN:
1. Go to /login
2. Enter company email and password
3. OR click "Continue with Google" / "Continue with Outlook"
4. If OTP enabled: enter OTP sent to your email
5. You land on your role-specific dashboard

HOW TO RESET PASSWORD:
1. Click "Forgot Password" on login page
2. Enter your email
3. Enter OTP received on /reset-otp page
4. Set new password on /reset-password page

HOW TO SIGNUP:
1. Go to /signup
2. Enter your company email
3. Verify with OTP
4. Set password
5. HR will assign your role and department
"""

def build_system_prompt(role: str, language: str) -> str:
    lang_map = {"en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil"}
    lang_name = lang_map.get(language, "English")

    role_context = {
        "employee":   "You are guiding an EMPLOYEE. Focus on: My Leaves, My Attendance, My Payslips, My Profile, WFH Requests, Helpdesk, My Documents, My Performance.",
        "manager":    "You are guiding a MANAGER. Focus on: Team Members, Leave Approvals, Team Attendance, Performance Reviews, Goals, Projects, Team Reports, Squad Management.",
        "hr":         "You are guiding an HR staff member. Focus on: Employee Directory, Add Member, Invite Member, Onboarding, Recruitment, Training, Leave Management, Documents.",
        "admin":      "You are guiding an ADMIN. Focus on: Admin Dashboard, Departments, Branches, Payroll Management, Audit Logs, Reports, Automation Center.",
        "superadmin": "You are guiding a SUPER ADMIN. Focus on: Companies, Users, Audit Logs, Automation Center, Financial Reports, full system settings.",
        "accountant": "You are guiding an ACCOUNTANT. Focus on: Payroll Dashboard, Payroll Processing, Salary Structure, Invoices, Expenses, Tax Deductions, Financial Reports.",
        "newuser":    "You are guiding a NEW USER. Focus on: Welcome page, Complete Profile, Upload Documents, View Policies, how to get fully onboarded as an employee.",
        "guest":      "You are helping a visitor understand NexHRMS features. Give general overviews. Encourage them to login for full access.",
    }.get(role, "You are helping a user navigate the NexHRMS website.")

    return f"""You are the NexHRMS Guide Bot for {COMPANY_NAME}.

YOUR ONLY JOB: Guide users on HOW TO USE the NexHRMS website. You do NOT perform any HR operations. You do NOT add employees, apply leaves, approve requests, or do anything in the system. You ONLY explain WHERE to go and WHAT to click on the website.

CURRENT USER ROLE: {role.upper()}
{role_context}

WEBSITE KNOWLEDGE BASE:
{WEBSITE_GUIDE}

HOW TO RESPOND:
1. Give clear step-by-step instructions
2. Always mention the exact page path (e.g. "Go to /my-leaves")
3. Keep responses under 150 words unless the process is complex
4. Use **bold** for page names, buttons, and important actions
5. Use numbered steps for processes
6. If user says "apply my leave" or "add employee" → guide them to the right page and explain the steps — do NOT do it yourself
7. If a feature is not available for their role, politely say so
8. For off-topic questions: "I only help with navigating the NexHRMS website. What would you like to find?"
9. If unsure about a specific UI detail: "Please check that page directly on the website for the exact steps"

RESPOND ONLY IN {lang_name}."""


# ── MODELS ─────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    message: str
    user_id: str = "guest"
    role: str = "employee"
    history: list = []
    language: str = "en"

class LoginRequest(BaseModel):
    emp_id: str
    password: str

ROLE_PASSWORDS = {
    "hr":         os.environ.get("HR_PASSWORD",         "hr@1234"),
    "manager":    os.environ.get("MANAGER_PASSWORD",    "mgr@1234"),
    "admin":      os.environ.get("ADMIN_PASSWORD",      "admin@1234"),
    "superadmin": os.environ.get("SUPERADMIN_PASSWORD", "super@1234"),
    "accountant": os.environ.get("ACCOUNTANT_PASSWORD", "acc@1234"),
    "newuser":    os.environ.get("NEWUSER_PASSWORD",    "new@1234"),
    "employee":   os.environ.get("EMPLOYEE_PASSWORD",   "emp@1234"),
}

ROLE_DISPLAY = {
    "hr": "HR Team", "manager": "Manager", "admin": "Admin",
    "superadmin": "Super Admin", "accountant": "Accountant",
    "newuser": "New User", "employee": "Employee"
}

# ── CHAT ENDPOINT ──────────────────────────────────────────────────
@app.post("/chat")
async def chat_endpoint(payload: ChatMessage):
    if not groq_client:
        return {"response": "Groq API key not configured. Please contact the admin."}

    system_full = build_system_prompt(payload.role, payload.language)
    messages = [
        {"role": m.get("role", "user"), "content": m.get("content", "")}
        for m in payload.history
    ]
    messages.append({"role": "user", "content": payload.message.strip()})

    for model in GROQ_MODELS:
        try:
            resp = groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system_full}] + messages,
                max_tokens=500,
                temperature=0.4,
            )
            reply = resp.choices[0].message.content.strip()
            print(f"✅ {model}")
            return {"response": reply}
        except Exception as e:
            print(f"⚠️ {model}: {str(e)[:60]}")

    return {"response": "I'm having trouble connecting right now. Please try again in a moment."}


# ── LOGIN ENDPOINT ──────────────────────────────────────────────────
@app.post("/api/login")
async def login_endpoint(payload: LoginRequest):
    emp_id   = payload.emp_id.strip().lower()
    password = payload.password.strip()

    if not emp_id or not password:
        return {"success": False, "message": "Please enter both ID and password."}

    if emp_id in ROLE_PASSWORDS:
        if password == ROLE_PASSWORDS[emp_id]:
            return {
                "success": True,
                "role":    emp_id,
                "name":    ROLE_DISPLAY.get(emp_id, emp_id.upper()),
                "emp_id":  emp_id,
                "message": f"Welcome, {ROLE_DISPLAY.get(emp_id, emp_id.upper())}!"
            }
        return {"success": False, "message": "Incorrect password. Please try again."}

    return {
        "success": False,
        "message": "Role not recognised. Please use: employee, manager, hr, admin, superadmin, accountant, or newuser"
    }


# ── ROOT ────────────────────────────────────────────────────────────
@app.get("/")
async def root():
    return {
        "status":  "alive",
        "product": PRODUCT_NAME,
        "company": COMPANY_NAME,
        "version": "2.0",
        "mode":    "Website Navigation Guide Only"
    }

print(f"\n{'='*60}")
print(f"✅ {PRODUCT_NAME} Guide Bot v2.0 ready")
print(f"🎯 Mode: Website Navigation Guide Only — No HR Operations")
print(f"{'='*60}\n")
