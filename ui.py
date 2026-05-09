import os
import re
import json
import time
import sqlite3
import base64
import urllib.request
import urllib.error
from datetime import datetime
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from groq import Groq

# ── CONFIG ─────────────────────────────────────────────────────────
COMPANY_NAME = "Future Invo Solutions"
PRODUCT_NAME = "NexHRMS"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
UPSTASH_REDIS_REST_URL = os.environ.get("UPSTASH_REDIS_REST_URL", "").rstrip("/")
UPSTASH_REDIS_REST_TOKEN = os.environ.get("UPSTASH_REDIS_REST_TOKEN", "")
UPSTASH_DB_KEY = os.environ.get("UPSTASH_DB_KEY", "nexhrms:sqlite:snapshot:v1")

# SQLite Database (auto-created, works everywhere)
#
# Render's /tmp can be wiped on restart. For local work we keep the DB beside
# ui.py; on Render, set NEXHRMS_DB_FILE=/data/nexhrms_demo.db after adding a
# persistent disk mounted at /data.
DEFAULT_DB_DIR = Path("/data") if Path("/data").exists() else Path(__file__).resolve().parent
DB_FILE = Path(os.environ.get("NEXHRMS_DB_FILE", DEFAULT_DB_DIR / "nexhrms_demo.db"))

def cloud_backup_enabled():
    return bool(UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN)

def upstash_command(command):
    if not cloud_backup_enabled():
        return None
    request = urllib.request.Request(
        UPSTASH_REDIS_REST_URL,
        data=json.dumps(command).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {UPSTASH_REDIS_REST_TOKEN}",
            "Content-Type": "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=15) as response:
        return json.loads(response.read().decode("utf-8"))

def restore_database_from_cloud():
    """Restore SQLite snapshot from free Upstash Redis, if configured."""
    if not cloud_backup_enabled() or DB_FILE.exists():
        return
    try:
        result = upstash_command(["GET", UPSTASH_DB_KEY])
        snapshot = (result or {}).get("result")
        if not snapshot:
            print("No Upstash database snapshot found yet")
            return
        DB_FILE.parent.mkdir(parents=True, exist_ok=True)
        DB_FILE.write_bytes(base64.b64decode(snapshot.encode("utf-8")))
        print(f"Restored SQLite database from Upstash into {DB_FILE}")
    except Exception as e:
        print(f"Cloud DB restore skipped: {e}")

def backup_database_to_cloud():
    """Upload SQLite DB snapshot to free Upstash Redis after writes."""
    if not cloud_backup_enabled() or not DB_FILE.exists():
        return
    try:
        snapshot = base64.b64encode(DB_FILE.read_bytes()).decode("utf-8")
        upstash_command(["SET", UPSTASH_DB_KEY, snapshot])
        print("Backed up SQLite database to Upstash")
    except Exception as e:
        print(f"Cloud DB backup failed: {e}")

# ── SQLITE SETUP ───────────────────────────────────────────────────
def init_database():
    """Initialize SQLite database with tables"""
    DB_FILE.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    
    # Create tables
    c.execute('''CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY,
        emp_id TEXT UNIQUE,
        name TEXT NOT NULL,
        department TEXT,
        designation TEXT,
        email TEXT,
        phone TEXT,
        joining_date TEXT,
        status TEXT DEFAULT 'Active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS leaves (
        id INTEGER PRIMARY KEY,
        leave_id TEXT UNIQUE,
        emp_id TEXT,
        emp_name TEXT,
        leave_type TEXT,
        days INTEGER,
        from_date TEXT,
        to_date TEXT,
        reason TEXT DEFAULT '',
        status TEXT DEFAULT 'Pending',
        applied_on TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS attendance (
        id INTEGER PRIMARY KEY,
        emp_id TEXT,
        emp_name TEXT,
        date TEXT,
        check_in TEXT,
        check_out TEXT DEFAULT '',
        status TEXT DEFAULT 'Present',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS hr_letters (
        id INTEGER PRIMARY KEY,
        letter_id TEXT UNIQUE,
        letter_type TEXT,
        emp_id TEXT,
        emp_name TEXT,
        generated_on TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Generated'
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY,
        asset_id TEXT UNIQUE,
        asset_name TEXT,
        emp_id TEXT,
        assigned_on TEXT DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'Active'
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS support_tickets (
        id INTEGER PRIMARY KEY,
        ticket_id TEXT UNIQUE,
        emp_id TEXT,
        emp_name TEXT,
        issue TEXT,
        status TEXT DEFAULT 'Open',
        created_on TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS activities (
        id INTEGER PRIMARY KEY,
        emp_name TEXT,
        action TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )''')
    
    c.execute('''CREATE TABLE IF NOT EXISTS policies (
        id INTEGER PRIMARY KEY,
        leave_type TEXT,
        days_per_year INTEGER,
        carry_forward BOOLEAN DEFAULT 0
    )''')
    
    # Insert default policies
    c.execute('SELECT COUNT(*) FROM policies')
    if c.fetchone()[0] == 0:
        policies = [
            ("Casual Leave", 12, False),
            ("Sick Leave", 10, False),
            ("Earned Leave", 15, True),
            ("Maternity Leave", 180, False),
            ("Paternity Leave", 15, False),
        ]
        c.executemany('INSERT INTO policies (leave_type, days_per_year, carry_forward) VALUES (?, ?, ?)', policies)
    
    conn.commit()
    conn.close()
    backup_database_to_cloud()
    print(f"✅ SQLite database initialized: {DB_FILE}")

def get_db():
    """Get database connection"""
    return sqlite3.connect(DB_FILE)

def dict_from_row(row, columns):
    """Convert SQLite row to dictionary"""
    return {columns[i]: row[i] for i in range(len(columns))}

# Restore cloud snapshot first, then initialize/migrate tables.
restore_database_from_cloud()

# Initialize DB on startup
init_database()

# ── COUNTERS ───────────────────────────────────────────────────────
EMP_COUNTER    = [1001]
TICKET_COUNTER = [100]
LETTER_COUNTER = [1]

def get_next_emp_id():
    """Get next employee ID"""
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT emp_id FROM employees ORDER BY id DESC LIMIT 1')
    result = c.fetchone()
    conn.close()
    if result and result[0]:
        last_id = int(result[0].replace('EMP', ''))
        return f"EMP{last_id + 1}"
    return f"EMP{EMP_COUNTER[0]}"

def get_next_leave_id():
    """Get next leave request ID"""
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT leave_id FROM leaves ORDER BY id DESC LIMIT 1')
    result = c.fetchone()
    conn.close()
    if result and result[0] and result[0].startswith("LV"):
        return f"LV{int(result[0].replace('LV', '')) + 1:03d}"
    return "LV001"

def clean_name(value: str) -> str:
    value = re.sub(r'[^a-zA-Z\s]', ' ', value or '')
    value = re.sub(r'\s+', ' ', value).strip()
    stop_words = {"employee", "name", "department", "designation", "leave", "sick", "casual", "earned"}
    words = [w for w in value.split() if w.lower() not in stop_words]
    return " ".join(words[:4]).title()

def extract_employee_details(text: str, data: dict = None, arg: str = ""):
    """Extract name, department and designation from direct text or action arg."""
    data = data or {}
    source = arg.strip() if arg else text.strip()
    if "|" in source:
        parts = [p.strip() for p in source.split("|")]
        name = clean_name(parts[0] if len(parts) > 0 else "")
        dept = (parts[1] if len(parts) > 1 else "").strip().title()
        desig = (parts[2] if len(parts) > 2 else "").strip().title()
        return name, dept or "General", desig or "Employee"

    low = text.lower()
    name = ""
    name_patterns = [
        r'(?:my name is|name is|named|employee named)\s+([a-zA-Z\s]+?)(?=\s+(?:in|as|for|with|department|dept|role|designation|email)\b|$)',
        r'add(?: a new)? employee\s+([a-zA-Z\s]+?)(?=\s+(?:in|as|for|with|department|dept|role|designation|email)\b|$)',
        r'create(?: a)? employee\s+([a-zA-Z\s]+?)(?=\s+(?:in|as|for|with|department|dept|role|designation|email)\b|$)',
    ]
    for pattern in name_patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            name = clean_name(match.group(1))
            break

    dept = ""
    departments = ["hr", "it", "finance", "sales", "marketing", "operations", "admin"]
    for dep in departments:
        if re.search(rf'\b{dep}\b', low):
            dept = dep.upper() if dep in {"hr", "it"} else dep.title()
            break
    dep_match = re.search(r'(?:department|dept)\s+(?:is\s+)?([a-zA-Z\s]+?)(?=\s+(?:as|role|designation)\b|$)', text, re.IGNORECASE)
    if dep_match:
        dept = clean_name(dep_match.group(1))

    desig = ""
    desig_match = re.search(r'(?:as|role|designation)\s+(?:is\s+)?([a-zA-Z\s]+)$', text, re.IGNORECASE)
    if desig_match:
        desig = clean_name(desig_match.group(1))
    else:
        for title in ["manager", "developer", "tester", "analyst", "executive", "lead", "hr", "designer", "accountant"]:
            if re.search(rf'\b{title}\b', low):
                desig = title.title()
                break

    return name or data.get("name", ""), dept or data.get("department", "General"), desig or data.get("designation", "Employee")

def create_employee_record(name: str, dept: str, designation: str):
    """Create an employee unless a similar active record already exists."""
    name = clean_name(name)
    if not name or len(name) < 2:
        return None, "Please provide a valid employee name."

    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT emp_id, name, department, designation FROM employees WHERE lower(name)=lower(?) AND status="Active" LIMIT 1', (name,))
    existing = c.fetchone()
    if existing:
        conn.close()
        return {
            "emp_id": existing[0],
            "name": existing[1],
            "department": existing[2],
            "designation": existing[3],
        }, "Employee already exists."

    emp_id = get_next_emp_id()
    c.execute('''INSERT INTO employees
                (emp_id, name, department, designation, status, joining_date, created_at)
                VALUES (?, ?, ?, ?, 'Active', ?, ?)''',
             (emp_id, name, dept or "General", designation or "Employee",
              datetime.now().strftime("%d %b %Y"),
              datetime.now().strftime("%d %b %Y %I:%M %p")))
    conn.commit()
    conn.close()
    backup_database_to_cloud()
    log_activity(name, f"Employee added - {emp_id}")
    return {
        "emp_id": emp_id,
        "name": name,
        "department": dept or "General",
        "designation": designation or "Employee",
    }, None

def resolve_employee(query: str, data: dict = None):
    data = data or {}
    if data.get("emp_id"):
        emp = get_employee_by_id(data["emp_id"])
        if emp:
            return emp
    query = (query or "").strip()
    emp_id_match = re.search(r'\bEMP\d+\b', query, re.IGNORECASE)
    if emp_id_match:
        return get_employee_by_id(emp_id_match.group(0))
    name = data.get("name") or ""
    patterns = [
        r'(?:for|employee|name is|my name is)\s+([a-zA-Z\s]+?)(?=\s+(?:from|for|on|sick|casual|earned|leave)\b|$)',
        r'^([a-zA-Z\s]{2,40})$',
    ]
    for pattern in patterns:
        match = re.search(pattern, query, re.IGNORECASE)
        if match:
            name = clean_name(match.group(1))
            break
    return get_employee_by_name(name) if name else None

def extract_leave_details(text: str):
    low = text.lower()
    leave_type = "Casual Leave"
    if "sick" in low:
        leave_type = "Sick Leave"
    elif "earned" in low:
        leave_type = "Earned Leave"
    elif "maternity" in low:
        leave_type = "Maternity Leave"
    elif "paternity" in low:
        leave_type = "Paternity Leave"

    days = 1
    days_match = re.search(r'(\d+)\s*(?:day|days)', low)
    if days_match:
        days = int(days_match.group(1))

    from_date = "TBD"
    to_date = "TBD"
    range_match = re.search(r'from\s+(.+?)\s+to\s+(.+?)(?:\s+for\s+\d+\s*days?|$)', text, re.IGNORECASE)
    if range_match:
        from_date = range_match.group(1).strip()
        to_date = range_match.group(2).strip()
    elif "tomorrow" in low:
        from_date = to_date = "Tomorrow"
    elif "today" in low:
        from_date = to_date = "Today"

    return leave_type, days, from_date, to_date

def create_leave_request(emp: dict, leave_type: str, days: int, from_date: str, to_date: str):
    leave_id = get_next_leave_id()
    conn = get_db()
    c = conn.cursor()
    c.execute('''INSERT INTO leaves
                (leave_id, emp_id, emp_name, leave_type, days, from_date, to_date, status, applied_on)
                VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending', ?)''',
             (leave_id, emp["emp_id"], emp["name"], leave_type, days, from_date, to_date,
              datetime.now().strftime("%d %b %Y %I:%M %p")))
    conn.commit()
    conn.close()
    backup_database_to_cloud()
    log_activity(emp["name"], f"Leave applied - {leave_id}")
    return leave_id

# ── HELPER FUNCTIONS ───────────────────────────────────────────────
def log_activity(name: str, action: str):
    """Log activity to database"""
    conn = get_db()
    c = conn.cursor()
    c.execute('INSERT INTO activities (emp_name, action, created_at) VALUES (?, ?, ?)',
             (name, action, datetime.now().strftime("%d %b %Y %I:%M %p")))
    conn.commit()
    conn.close()
    backup_database_to_cloud()

def get_employee_by_name(name: str):
    """Search employee by name (fuzzy match)"""
    if not name or len(name) < 2:
        return None
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM employees WHERE name LIKE ? LIMIT 1', (f"%{name}%",))
    row = c.fetchone()
    conn.close()
    if row:
        cols = [desc[0] for desc in c.description]
        return dict_from_row(row, cols)
    return None

def get_employee_by_id(emp_id: str):
    """Get employee by ID"""
    if not emp_id:
        return None
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT * FROM employees WHERE emp_id = ? LIMIT 1', (emp_id.upper(),))
    row = c.fetchone()
    conn.close()
    if row:
        cols = [desc[0] for desc in c.description]
        return dict_from_row(row, cols)
    return None

# ── FastAPI Setup ──────────────────────────────────────────────────
app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True,
                   allow_methods=["*"], allow_headers=["*"])

groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

class ChatMessage(BaseModel):
    message: str
    user_id: str
    role: str = "employee"
    state: str = "IDLE"
    data: dict = {}
    history: list = []
    language: str = "en"

# ── SYSTEM PROMPT ──────────────────────────────────────────────────
SYSTEM_PROMPT = """You are the {product} HR Assistant for {company}. You are warm, professional, and thorough.

YOUR CURRENT ROLE: {role}
- employee → help with THEIR OWN leave, attendance, profile only
- manager  → help manage THEIR TEAM leaves, attendance, reports
- hr       → add employees, generate letters, manage policies, records
- admin    → full access to everything

IDENTITY RULE:
If asked "who are you" or "what can you do":
- employee → "I'm your Personal HR Assistant! I help you apply leaves, check balances, and mark attendance."
- manager  → "I'm your Team Manager Assistant! I help you approve leaves and view your team's attendance."
- hr       → "I'm the HR Admin Assistant! I help you add employees, generate letters, and manage records."
- admin    → "I'm the System Administrator with full access to all data and reports."

════════════════════════════════════════════════
STRICT CONVERSATION FLOWS — FOLLOW EXACTLY
════════════════════════════════════════════════

▶ FLOW 1: ADD EMPLOYEE (HR/Admin only)
Step 1 → Ask: "What is the full name of the new employee?"
Step 2 → Ask: "Which department will {name} be joining? (e.g. IT, HR, Finance, Marketing, Operations)"
Step 3 → Ask: "What is {name}'s designation/job title? (e.g. Software Developer, HR Executive, Accountant)"
Step 4 → Ask: "What is {name}'s email address? (or type 'skip' to add later)"
Step 5 → Ask: "What is {name}'s phone number? (or type 'skip' to add later)"
Step 6 → Show summary and ask: "Please confirm these details:
  👤 Name: {name}
  🏢 Department: {dept}
  💼 Designation: {designation}
  📧 Email: {email}
  📱 Phone: {phone}
  
  Type YES to confirm and add the employee, or NO to make changes."
Step 7 → ONLY after user says YES → fire [ACTION:ADD_EMPLOYEE:name|dept|designation|email|phone]

RULE: Do NOT fire ADD_EMPLOYEE until all steps are complete and user confirms YES.

▶ FLOW 2: APPLY LEAVE (Employee only)
Step 1 → Ask: "What type of leave would you like to apply for?
  • Casual Leave (12 days/year)
  • Sick Leave (10 days/year)
  • Earned Leave (15 days/year)
  • Maternity Leave (180 days)
  • Paternity Leave (15 days)"
Step 2 → Ask: "What is the start date of your leave? (e.g. 15 May 2026)"
Step 3 → Ask: "What is the end date of your leave? (e.g. 17 May 2026)"
Step 4 → Calculate days and ask: "What is the reason for your leave?"
Step 5 → Show summary: "Here's your leave request:
  📋 Type: {leave_type}
  📅 From: {from_date}
  📅 To: {to_date}
  📆 Total: {days} day(s)
  📝 Reason: {reason}
  
  Type YES to submit or NO to cancel."
Step 6 → ONLY after YES → fire [ACTION:APPLY_LEAVE:leave_type|from_date|to_date|days|reason]

RULE: Do NOT fire APPLY_LEAVE until all 5 details are collected and user confirms YES.

▶ FLOW 3: APPROVE/REJECT LEAVE (Manager/HR only)
Step 1 → Show list of pending leaves from database
Step 2 → Ask: "Which employee's leave would you like to approve or reject?"
Step 3 → Ask: "Would you like to APPROVE or REJECT this leave request?"
Step 4 → Ask: "Any comments or reason? (optional — type 'skip' to proceed)"
Step 5 → Confirm: "You are about to {approve/reject} {name}'s {leave_type} leave. Confirm? YES/NO"
Step 6 → ONLY after YES → fire [ACTION:APPROVE_LEAVE:name] or [ACTION:REJECT_LEAVE:name]

▶ FLOW 4: GENERATE LETTER (HR/Admin only)
Step 1 → Ask: "Which employee is this letter for? Please enter their name or Employee ID."
Step 2 → Look up employee and confirm: "Found: {name} ({emp_id}), {designation} in {dept}. Is this correct? YES/NO"
Step 3 → Ask: "What type of letter do you need?
  • Offer Letter
  • Experience Letter
  • Relieving Letter
  • Promotion Letter
  • Salary Certificate"
Step 4 → Ask: "Any additional details to include? (e.g. salary, joining date — or type 'skip')"
Step 5 → Confirm: "Generating {letter_type} for {name}. Confirm? YES/NO"
Step 6 → ONLY after YES → fire [ACTION:GENERATE_LETTER:letter_type|emp_id]

▶ FLOW 5: MARK ATTENDANCE (Employee only)
Step 1 → Confirm: "I'll mark your attendance for today ({today_date}). Confirm? YES/NO"
Step 2 → ONLY after YES → fire [ACTION:MARK_ATTENDANCE]

▶ FLOW 6: ASSIGN ASSET (HR/Admin only)
Step 1 → Ask: "Which employee are you assigning this asset to?"
Step 2 → Ask: "What asset are you assigning? (e.g. Laptop, Mobile Phone, Access Card)"
Step 3 → Ask: "What is the asset serial number or ID? (or type 'skip')"
Step 4 → Confirm summary → ONLY after YES → fire [ACTION:ASSIGN_ASSET:asset_name|emp_name]

════════════════════════════════════════════════
GENERAL RULES
════════════════════════════════════════════════
1. NEVER skip steps — always ask one question at a time
2. NEVER fire an ACTION tag until user explicitly says YES to confirm
3. If user gives multiple details at once (e.g. "Add Rahul in IT as Developer"), acknowledge them and continue from the next missing step — don't skip confirmation
4. If a detail is already provided, don't ask for it again — move to next missing step
5. Never ask more than ONE question per message
6. Use **bold** for important values like **EMP1001**, **IT**, **Casual Leave**
7. Always show a clear summary before confirming
8. Employees cannot approve leaves — only managers and HR
9. Keep responses clear and friendly — no jargon
10. For off-topic questions: "I'm here to help with HR tasks only. What would you like to do?"

ACTION TAGS (place silently at end of response, only after YES confirmation):
[ACTION:ADD_EMPLOYEE:name|dept|designation|email|phone]
[ACTION:APPLY_LEAVE:leave_type|from_date|to_date|days|reason]
[ACTION:APPROVE_LEAVE:employee_name]
[ACTION:REJECT_LEAVE:employee_name]
[ACTION:GENERATE_LETTER:letter_type|emp_id]
[ACTION:MARK_ATTENDANCE]
[ACTION:ASSIGN_ASSET:asset_name|emp_name]

RESPOND ONLY IN {language}. NEVER mix languages."""

def build_system_prompt(role: str, language: str) -> str:
    """Build system prompt injecting REAL employee data from SQLite"""
    lang_map = {"en": "English", "hi": "Hindi", "te": "Telugu", "ta": "Tamil"}
    lang_name = lang_map.get(language, "English")
    base = SYSTEM_PROMPT.format(
        product=PRODUCT_NAME,
        company=COMPANY_NAME,
        role=role,
        language=lang_name
    )

    # Read real data from SQLite and inject — Groq must NEVER invent employees
    try:
        conn = get_db()
        c = conn.cursor()

        c.execute('SELECT emp_id, name, department, designation FROM employees WHERE status="Active" ORDER BY created_at DESC')
        emps = c.fetchall()
        if emps:
            emp_lines = "\n".join(f"  {r[0]} | {r[1]} | {r[2]} | {r[3]}" for r in emps)
        else:
            emp_lines = "  NONE — no employees have been added yet"

        c.execute('SELECT emp_name, leave_type, days, from_date, to_date FROM leaves WHERE status="Pending"')
        pending = c.fetchall()
        leave_lines = "\n".join(f"  {r[0]}: {r[1]} {r[2]} days ({r[3]} to {r[4]})" for r in pending) if pending else "  None"

        today = datetime.now().strftime("%d %b %Y")
        c.execute('SELECT emp_name, check_in FROM attendance WHERE date=?', (today,))
        att = c.fetchall()
        att_lines = "\n".join(f"  {r[0]} checked in at {r[1]}" for r in att) if att else "  None today"

        conn.close()

        context = f"""

=== LIVE DATABASE (ONLY use this data — NEVER invent or assume employee names) ===
Employees in system ({len(emps)} total):
{emp_lines}

Pending leave requests:
{leave_lines}

Today attendance ({today}):
{att_lines}

STRICT RULES:
- If asked "show employees" or "list employees" — show ONLY the names above
- If emp_lines says NONE — say "No employees added yet"
- NEVER show John Doe, Jane Smith, Bob Brown or any made-up names
- When adding employee use: [ACTION:ADD_EMPLOYEE:Name|Department|Designation]
==="""
        return base + context

    except Exception as e:
        print(f"Context error: {e}")
        return base

# ── ACTION PROCESSING ──────────────────────────────────────────────
def process_action(cmd: str, arg: str, data: dict, role: str, raw_msg: str = ""):
    """Process Groq's action tags"""
    if not cmd:
        return
    
    conn = get_db()
    c = conn.cursor()
    
    # ADD_EMPLOYEE
    if cmd == "ADD_EMPLOYEE" and not data.get("employee_added"):
        parts = [p.strip() for p in arg.split("|")] if arg else []
        name        = parts[0] if len(parts) > 0 else data.get("name", "Unknown")
        dept        = parts[1] if len(parts) > 1 else data.get("department", "IT")
        designation = parts[2] if len(parts) > 2 else data.get("designation", "Employee")
        email       = parts[3] if len(parts) > 3 else data.get("email", "")
        phone       = parts[4] if len(parts) > 4 else data.get("phone", "")

        # Clean skip values
        email = "" if email.lower() in ["skip", "none", "-"] else email
        phone = "" if phone.lower() in ["skip", "none", "-"] else phone
        
        if name == "Unknown" or len(name) < 2:
            conn.close()
            return  # Don't add if no valid name
        
        emp_id = get_next_emp_id()
        try:
            c.execute('''INSERT INTO employees 
                        (emp_id, name, department, designation, email, phone, status, joining_date, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, 'Active', ?, ?)''',
                     (emp_id, name, dept, designation, email, phone,
                      datetime.now().strftime("%d %b %Y"),
                      datetime.now().strftime("%d %b %Y %I:%M %p")))
            conn.commit()
            backup_database_to_cloud()
            data["employee_added"] = True
            data["emp_id"] = emp_id
            data["name"] = name
            log_activity(name, f"Employee added — {emp_id}")
            print(f"✅ Added employee: {name} ({emp_id}) | {dept} | {designation}")
        except Exception as e:
            print(f"Error adding employee: {e}")
    
    # MARK_ATTENDANCE
    elif cmd == "MARK_ATTENDANCE":
        emp_name = data.get("name", "")
        if emp_name and role == "employee":
            emp = get_employee_by_name(emp_name)
            if emp:
                today = datetime.now().strftime("%d %b %Y")
                try:
                    c.execute('SELECT * FROM attendance WHERE emp_id = ? AND date = ?',
                             (emp["emp_id"], today))
                    if not c.fetchone():
                        c.execute('''INSERT INTO attendance 
                                    (emp_id, emp_name, date, check_in, status, created_at)
                                    VALUES (?, ?, ?, ?, 'Present', ?)''',
                                 (emp["emp_id"], emp_name, today,
                                  datetime.now().strftime("%I:%M %p"),
                                  datetime.now().strftime("%d %b %Y %I:%M %p")))
                        conn.commit()
                        backup_database_to_cloud()
                        data["attendance_marked"] = True
                        log_activity(emp_name, f"Attendance marked — {today}")
                        print(f"✅ Attendance marked for {emp_name}")
                except Exception as e:
                    print(f"Error marking attendance: {e}")

    # APPLY_LEAVE — parse leave_type|from_date|to_date|days|reason
    elif cmd == "APPLY_LEAVE" and not data.get("leave_applied"):
        parts       = [p.strip() for p in arg.split("|")] if arg else []
        leave_type  = parts[0] if len(parts) > 0 else data.get("leave_type", "Casual Leave")
        from_date   = parts[1] if len(parts) > 1 else data.get("from_date", "")
        to_date     = parts[2] if len(parts) > 2 else data.get("to_date", "")
        days        = parts[3] if len(parts) > 3 else data.get("days", "1")
        reason      = parts[4] if len(parts) > 4 else data.get("reason", "Personal")
        emp_name    = data.get("name", "Employee")
        emp_id      = data.get("emp_id", "")

        # Clean skip
        reason = "Personal" if reason.lower() in ["skip", "none", "-"] else reason

        try:
            days_int = int(days)
        except:
            days_int = 1

        try:
            # Get leave count for ID
            c.execute('SELECT COUNT(*) FROM leaves')
            count    = c.fetchone()[0]
            leave_id = f"LV{count + 1:03d}"
            c.execute('''INSERT INTO leaves
                        (leave_id, emp_id, emp_name, leave_type, days, from_date, to_date, reason, status, applied_on)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending', ?)''',
                     (leave_id, emp_id, emp_name, leave_type, days_int,
                      from_date, to_date, reason,
                      datetime.now().strftime("%d %b %Y %I:%M %p")))
            conn.commit()
            backup_database_to_cloud()
            data["leave_applied"] = True
            data["leave_id"]      = leave_id
            log_activity(emp_name, f"Leave applied — {leave_type} {days_int} days ({from_date} to {to_date})")
            print(f"✅ Leave applied: {emp_name} | {leave_type} | {days_int} days | {leave_id}")
        except Exception as e:
            print(f"Error applying leave: {e}")
    
    conn.close()

# ── CHAT ENDPOINT ──────────────────────────────────────────────────
def mark_attendance_for(emp: dict, data: dict = None):
    data = data or {}
    today = datetime.now().strftime("%d %b %Y")
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT id FROM attendance WHERE emp_id = ? AND date = ?', (emp["emp_id"], today))
    if not c.fetchone():
        c.execute('''INSERT INTO attendance
                    (emp_id, emp_name, date, check_in, status, created_at)
                    VALUES (?, ?, ?, ?, 'Present', ?)''',
                 (emp["emp_id"], emp["name"], today,
                  datetime.now().strftime("%I:%M %p"),
                  datetime.now().strftime("%d %b %Y %I:%M %p")))
        conn.commit()
        log_activity(emp["name"], f"Attendance marked - {today}")
    conn.close()
    backup_database_to_cloud()
    data.update({"attendance_marked": True, "emp_id": emp["emp_id"], "name": emp["name"]})

def reject_latest_leave(query: str):
    target = clean_name(query)
    conn = get_db()
    c = conn.cursor()
    if target:
        c.execute('''UPDATE leaves SET status='Rejected'
                    WHERE id = (
                        SELECT id FROM leaves
                        WHERE LOWER(emp_name) LIKE ? AND status='Pending'
                        ORDER BY id DESC LIMIT 1
                    )''', (f"%{target.lower()}%",))
    else:
        c.execute('''UPDATE leaves SET status='Rejected'
                    WHERE id = (SELECT id FROM leaves WHERE status='Pending' ORDER BY id DESC LIMIT 1)''')
    affected = c.rowcount
    conn.commit()
    conn.close()
    if affected:
        backup_database_to_cloud()
    return affected > 0
    target = clean_name(query)
    conn = get_db()
    c = conn.cursor()
    if target:
        c.execute('''UPDATE leaves SET status='Approved'
                    WHERE id = (
                        SELECT id FROM leaves
                        WHERE status='Pending' AND (lower(emp_name)=lower(?) OR emp_name LIKE ?)
                        ORDER BY id DESC LIMIT 1
                    )''', (target, f"%{target}%"))
    else:
        c.execute('''UPDATE leaves SET status='Approved'
                    WHERE id = (SELECT id FROM leaves WHERE status='Pending' ORDER BY id DESC LIMIT 1)''')
    changed = c.rowcount
    conn.commit()
    conn.close()
    backup_database_to_cloud()
    return changed > 0

def list_employees_text():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT emp_id, name, department, designation FROM employees WHERE status="Active" ORDER BY id')
    rows = c.fetchall()
    conn.close()
    if not rows:
        return "No employees have been added yet. To add one, switch to HR/Admin and type: `Add employee named Rahul Sharma in IT as Developer`."
    lines = ["Here are the employees currently saved:"]
    lines += [f"{i + 1}. **{r[1]}** - `{r[0]}` | {r[2]} | {r[3]}" for i, r in enumerate(rows)]
    return "\n".join(lines)

def pending_leaves_text():
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT leave_id, emp_name, leave_type, days, from_date, to_date FROM leaves WHERE status="Pending" ORDER BY id')
    rows = c.fetchall()
    conn.close()
    if not rows:
        return "No pending leave requests right now."
    lines = ["Pending leave requests:"]
    lines += [f"{i + 1}. `{r[0]}` - **{r[1]}**, {r[2]}, {r[3]} day(s), {r[4]} to {r[5]}" for i, r in enumerate(rows)]
    return "\n".join(lines)

def handle_direct_action(raw_msg: str, role: str, state: str, data: dict):
    """
    State machine for multi-step HR flows.
    Returns a response dict or None (to fall through to Groq).
    States:
      IDLE                 → normal Groq conversation
      ADD_EMP_NAME         → waiting for employee name
      ADD_EMP_DEPT         → waiting for department
      ADD_EMP_DESIG        → waiting for designation
      ADD_EMP_EMAIL        → waiting for email
      ADD_EMP_PHONE        → waiting for phone
      ADD_EMP_CONFIRM      → waiting for YES/NO confirmation
      LEAVE_TYPE           → waiting for leave type
      LEAVE_FROM           → waiting for start date
      LEAVE_TO             → waiting for end date
      LEAVE_REASON         → waiting for reason
      LEAVE_CONFIRM        → waiting for YES/NO confirmation
      APPROVE_WHO          → waiting for employee name to approve
      APPROVE_CONFIRM      → waiting for YES/NO to approve
    """
    low = raw_msg.lower().strip()
    yes = low in ["yes", "y", "confirm", "ok", "sure", "proceed", "haan", "ha"]
    no  = low in ["no", "n", "cancel", "stop", "nahi", "nope"]

    # ── SIMPLE READS (no state machine needed) ────────────────────
    if any(p in low for p in ["show all employees", "list employees", "view all employees", "show employees"]):
        return {"response": list_employees_text(), "state": "IDLE", "data": data}

    if any(p in low for p in ["pending leave", "leave requests", "show leaves", "view leaves", "pending requests"]):
        if role not in {"manager", "hr", "admin"}:
            return {"response": "Only Manager, HR, or Admin can view leave requests.", "state": "IDLE", "data": data}
        return {"response": pending_leaves_text(), "state": "IDLE", "data": data}

    # ── CANCEL anytime ────────────────────────────────────────────
    if no and state not in ["IDLE"]:
        data = {}
        return {"response": "❌ Cancelled. What else can I help you with?", "state": "IDLE", "data": data}

    # ══════════════════════════════════════════════════════════════
    # FLOW 1: ADD EMPLOYEE
    # ══════════════════════════════════════════════════════════════

    # Trigger: detect add employee intent
    if state == "IDLE" and ("add" in low or "create" in low or "new" in low) and "employee" in low:
        if role not in {"hr", "admin"}:
            return {"response": "⛔ Only HR or Admin can add employees.", "state": "IDLE", "data": data}
        return {
            "response": "Sure! Let's add a new employee step by step. 📝\n\nFirst, what is the **full name** of the new employee?",
            "state": "ADD_EMP_NAME",
            "data": {}
        }

    if state == "ADD_EMP_NAME":
        name = raw_msg.strip().title()
        if len(name) < 2:
            return {"response": "Please enter a valid full name (at least 2 characters).", "state": "ADD_EMP_NAME", "data": data}
        data["name"] = name
        return {
            "response": f"Got it — **{name}**. 👍\n\nWhich **department** will {name} be joining?\n\nOptions: IT · HR · Finance · Marketing · Operations · Sales · Admin · Other",
            "state": "ADD_EMP_DEPT",
            "data": data
        }

    if state == "ADD_EMP_DEPT":
        dept = raw_msg.strip().title()
        if len(dept) < 2:
            return {"response": "Please enter a valid department name.", "state": "ADD_EMP_DEPT", "data": data}
        data["department"] = dept
        return {
            "response": f"Department: **{dept}** ✅\n\nWhat is **{data['name']}'s** job title / designation?\n\nExamples: Software Developer · HR Executive · Accountant · Marketing Manager",
            "state": "ADD_EMP_DESIG",
            "data": data
        }

    if state == "ADD_EMP_DESIG":
        desig = raw_msg.strip().title()
        if len(desig) < 2:
            return {"response": "Please enter a valid designation.", "state": "ADD_EMP_DESIG", "data": data}
        data["designation"] = desig
        return {
            "response": f"Designation: **{desig}** ✅\n\nWhat is **{data['name']}'s** email address?\n_(Type **skip** to add later)_",
            "state": "ADD_EMP_EMAIL",
            "data": data
        }

    if state == "ADD_EMP_EMAIL":
        email = "" if low in ["skip", "none", "-", "no"] else raw_msg.strip()
        data["email"] = email
        return {
            "response": f"{'Email: **' + email + '** ✅' if email else 'Email skipped.'}\n\nWhat is **{data['name']}'s** phone number?\n_(Type **skip** to add later)_",
            "state": "ADD_EMP_PHONE",
            "data": data
        }

    if state == "ADD_EMP_PHONE":
        phone = "" if low in ["skip", "none", "-", "no"] else raw_msg.strip()
        data["phone"] = phone
        name  = data.get("name", "")
        dept  = data.get("department", "")
        desig = data.get("designation", "")
        email = data.get("email", "") or "Not provided"
        return {
            "response": (
                f"Please confirm the details below:\n\n"
                f"👤 **Name:** {name}\n"
                f"🏢 **Department:** {dept}\n"
                f"💼 **Designation:** {desig}\n"
                f"📧 **Email:** {email}\n"
                f"📱 **Phone:** {phone or 'Not provided'}\n\n"
                f"Type **YES** to add this employee or **NO** to cancel."
            ),
            "state": "ADD_EMP_CONFIRM",
            "data": data
        }

    if state == "ADD_EMP_CONFIRM":
        if yes:
            name  = data.get("name", "Unknown")
            dept  = data.get("department", "General")
            desig = data.get("designation", "Employee")
            email = data.get("email", "")
            phone = data.get("phone", "")
            emp, error = create_employee_record(name, dept, desig)
            if not emp:
                return {"response": f"❌ Could not add employee: {error}", "state": "IDLE", "data": {}}
            # Update email and phone in DB
            if email or phone:
                try:
                    conn = get_db()
                    c = conn.cursor()
                    c.execute('UPDATE employees SET email=?, phone=? WHERE emp_id=?', (email, phone, emp["emp_id"]))
                    conn.commit()
                    conn.close()
                except: pass
            data.update({"employee_added": True, "emp_id": emp["emp_id"], "name": emp["name"]})
            return {
                "response": (
                    f"✅ **{name}** has been added successfully!\n\n"
                    f"🆔 **Employee ID:** `{emp['emp_id']}`\n"
                    f"🏢 **Department:** {dept}\n"
                    f"💼 **Designation:** {desig}\n\n"
                    f"Their default login password is **emp@1234**\n"
                    f"They can login using: `{emp['emp_id']}` / `emp@1234`"
                ),
                "state": "IDLE",
                "data": data
            }
        else:
            return {"response": "❌ Cancelled. Type 'add employee' to start again.", "state": "IDLE", "data": {}}

    # ══════════════════════════════════════════════════════════════
    # FLOW 2: APPLY LEAVE
    # ══════════════════════════════════════════════════════════════

    if state == "IDLE" and "leave" in low and any(w in low for w in ["apply", "request", "need", "want", "take"]):
        return {
            "response": (
                "Sure! Let's apply for leave. 📋\n\n"
                "What **type of leave** would you like?\n\n"
                "1️⃣ Casual Leave _(12 days/year)_\n"
                "2️⃣ Sick Leave _(10 days/year)_\n"
                "3️⃣ Earned Leave _(15 days/year)_\n"
                "4️⃣ Maternity Leave _(180 days)_\n"
                "5️⃣ Paternity Leave _(15 days)_\n\n"
                "Type the name or number."
            ),
            "state": "LEAVE_TYPE",
            "data": {}
        }

    if state == "LEAVE_TYPE":
        leave_map = {
            "1": "Casual Leave", "casual": "Casual Leave",
            "2": "Sick Leave",   "sick":   "Sick Leave",
            "3": "Earned Leave", "earned": "Earned Leave",
            "4": "Maternity Leave", "maternity": "Maternity Leave",
            "5": "Paternity Leave", "paternity": "Paternity Leave",
        }
        leave_type = None
        for key, val in leave_map.items():
            if key in low:
                leave_type = val
                break
        if not leave_type:
            return {"response": "Please choose a valid leave type: Casual, Sick, Earned, Maternity, or Paternity.", "state": "LEAVE_TYPE", "data": data}
        data["leave_type"] = leave_type
        return {
            "response": f"**{leave_type}** selected ✅\n\nWhat is the **start date** of your leave?\n_Example: 15 May 2026_",
            "state": "LEAVE_FROM",
            "data": data
        }

    if state == "LEAVE_FROM":
        from_date = raw_msg.strip()
        if len(from_date) < 3:
            return {"response": "Please enter a valid start date. Example: 15 May 2026", "state": "LEAVE_FROM", "data": data}
        data["from_date"] = from_date
        return {
            "response": f"Start date: **{from_date}** ✅\n\nWhat is the **end date** of your leave?\n_Example: 17 May 2026_",
            "state": "LEAVE_TO",
            "data": data
        }

    if state == "LEAVE_TO":
        to_date = raw_msg.strip()
        if len(to_date) < 3:
            return {"response": "Please enter a valid end date. Example: 17 May 2026", "state": "LEAVE_TO", "data": data}
        data["to_date"] = to_date
        return {
            "response": f"End date: **{to_date}** ✅\n\nWhat is the **reason** for your leave?\n_Example: Family function, Medical appointment, Personal work_",
            "state": "LEAVE_REASON",
            "data": data
        }

    if state == "LEAVE_REASON":
        reason = raw_msg.strip()
        data["reason"] = reason
        leave_type = data.get("leave_type", "Casual Leave")
        from_date  = data.get("from_date", "")
        to_date    = data.get("to_date", "")
        return {
            "response": (
                f"Please confirm your leave request:\n\n"
                f"📋 **Type:** {leave_type}\n"
                f"📅 **From:** {from_date}\n"
                f"📅 **To:** {to_date}\n"
                f"📝 **Reason:** {reason}\n\n"
                f"Type **YES** to submit or **NO** to cancel."
            ),
            "state": "LEAVE_CONFIRM",
            "data": data
        }

    if state == "LEAVE_CONFIRM":
        if yes:
            emp = resolve_employee("", data)
            if not emp:
                return {"response": "Could not find your employee record. Please contact HR.", "state": "IDLE", "data": {}}
            leave_type = data.get("leave_type", "Casual Leave")
            from_date  = data.get("from_date", "")
            to_date    = data.get("to_date", "")
            reason     = data.get("reason", "Personal")
            leave_id   = create_leave_request(emp, leave_type, 1, from_date, to_date)
            return {
                "response": (
                    f"✅ Leave request submitted!\n\n"
                    f"🆔 **Request ID:** `{leave_id}`\n"
                    f"📋 **Type:** {leave_type}\n"
                    f"📅 **From:** {from_date} → **To:** {to_date}\n"
                    f"📝 **Reason:** {reason}\n"
                    f"⏳ **Status:** Pending manager approval"
                ),
                "state": "IDLE",
                "data": data
            }
        else:
            return {"response": "❌ Leave request cancelled.", "state": "IDLE", "data": {}}

    # ══════════════════════════════════════════════════════════════
    # FLOW 3: APPROVE/REJECT LEAVE
    # ══════════════════════════════════════════════════════════════

    if state == "IDLE" and ("approve" in low or "reject" in low) and "leave" in low:
        if role not in {"manager", "hr", "admin"}:
            return {"response": "⛔ Only Manager, HR, or Admin can approve/reject leaves.", "state": "IDLE", "data": data}
        pending = pending_leaves_text()
        return {
            "response": f"{pending}\n\nWhich employee's leave would you like to **approve or reject**?\nType the employee name.",
            "state": "APPROVE_WHO",
            "data": data
        }

    if state == "APPROVE_WHO":
        data["approve_name"] = raw_msg.strip()
        return {
            "response": f"Do you want to **APPROVE** or **REJECT** {data['approve_name']}'s leave request?",
            "state": "APPROVE_ACTION",
            "data": data
        }

    if state == "APPROVE_ACTION":
        if "approve" in low:
            data["approve_action"] = "approve"
        elif "reject" in low:
            data["approve_action"] = "reject"
        else:
            return {"response": "Please type **APPROVE** or **REJECT**.", "state": "APPROVE_ACTION", "data": data}
        action = data["approve_action"]
        name   = data.get("approve_name", "")
        return {
            "response": f"Confirm: You want to **{action.upper()}** {name}'s leave request. Type **YES** or **NO**.",
            "state": "APPROVE_CONFIRM",
            "data": data
        }

    if state == "APPROVE_CONFIRM":
        if yes:
            name   = data.get("approve_name", "")
            action = data.get("approve_action", "approve")
            if action == "approve":
                ok = approve_latest_leave(name)
                msg = f"✅ {name}'s leave has been **approved**." if ok else f"Could not find a pending leave for {name}."
            else:
                ok = reject_latest_leave(name)
                msg = f"❌ {name}'s leave has been **rejected**." if ok else f"Could not find a pending leave for {name}."
            return {"response": msg, "state": "IDLE", "data": {}}
        else:
            return {"response": "Cancelled.", "state": "IDLE", "data": {}}

    # ══════════════════════════════════════════════════════════════
    # ATTENDANCE MARK
    # ══════════════════════════════════════════════════════════════

    if state == "IDLE" and "attendance" in low and any(w in low for w in ["mark", "check in", "present", "log"]):
        emp = resolve_employee(raw_msg, data)
        if not emp:
            return {"response": "I could not find your employee record. Please contact HR to ensure you're registered.", "state": "IDLE", "data": data}
        today = datetime.now().strftime("%d %b %Y")
        return {
            "response": f"Mark your attendance for today **{today}**?\n\nType **YES** to confirm.",
            "state": "ATTENDANCE_CONFIRM",
            "data": {**data, "emp_id": emp["emp_id"], "name": emp["name"]}
        }

    if state == "ATTENDANCE_CONFIRM":
        if yes:
            emp = resolve_employee("", data)
            if emp:
                mark_attendance_for(emp, data)
                return {"response": f"✅ Attendance marked for **{emp['name']}** today at {datetime.now().strftime('%I:%M %p')}.", "state": "IDLE", "data": data}
        return {"response": "Attendance not marked.", "state": "IDLE", "data": data}

    return None

@app.post("/chat")
async def chat_endpoint(payload: ChatMessage):
    raw_msg = payload.message.strip()
    user_id = payload.user_id
    role = payload.role or "employee"
    language = payload.language or "en"
    state = payload.state or "IDLE"
    data = payload.data or {}
    history = payload.history or []

    direct = handle_direct_action(raw_msg, role, state, data)
    if direct:
        return direct

    if not groq_client:
        return {"response": "Groq API key not configured. Core actions like adding employees and applying leave still work.", "state": state, "data": data}
    
    # Build system prompt with role injection
    system_full = build_system_prompt(role, language)
    
    # Add message to history
    messages = [{"role": m.get("role", "user"), "content": m.get("content", "")} for m in history]
    messages.append({"role": "user", "content": raw_msg})
    
    # Try models in order (fallback chain)
    models_to_try = [
        "llama-3.1-8b-instant",
        "llama-3.3-70b-versatile",
        "llama3-8b-8192"
    ]
    
    bot_reply = None
    last_error = None
    
    for model in models_to_try:
        try:
            response = groq_client.chat.completions.create(
                model=model,
                messages=[{"role": "system", "content": system_full}] + messages,
                max_tokens=400,
                temperature=0.7
            )
            bot_reply = response.choices[0].message.content.strip()
            print(f"✅ Using {model}")
            break
        except Exception as e:
            last_error = str(e)
            print(f"⚠️ {model} failed: {str(e)[:80]}")
            continue
    
    if bot_reply is None:
        return {
            "response": f"Sorry, all Groq models are unavailable: {last_error[:100]}",
            "state": state,
            "data": data,
        }
    
    # Extract action tags
    action_match = re.search(r'\[ACTION:(\w+)(?::([^\]]*))?\]', bot_reply)
    if action_match:
        cmd = action_match.group(1)
        arg = action_match.group(2) or ""
        process_action(cmd, arg, data, role, raw_msg)
        # Remove action tag from visible response
        bot_reply = re.sub(r'\[ACTION:[^\]]*\]', '', bot_reply).strip()
    
    return {
        "response": bot_reply,
        "state": state,
        "data": data,
    }

# ── ESS SEARCH ENDPOINT ────────────────────────────────────────────
@app.get("/api/ess/search/{query}")
async def ess_search(query: str):
    """Search employees by name or emp_id"""
    if not query or len(query.strip()) < 2:
        return {"results": [], "count": 0, "error": "Search term must be at least 2 characters"}
    
    # Validate input
    query_clean = re.sub(r'[^a-zA-Z0-9\s]', '', query.strip())
    if len(query_clean) < 2:
        return {"results": [], "count": 0, "error": "Invalid search term"}
    
    conn = get_db()
    c = conn.cursor()
    c.execute('''SELECT emp_id, name, department, designation FROM employees 
                WHERE name LIKE ? OR emp_id LIKE ? ORDER BY name''',
             (f"%{query_clean}%", f"%{query_clean}%"))
    
    results = []
    for row in c.fetchall():
        results.append({
            "emp_id": row[0],
            "name": row[1],
            "department": row[2],
            "designation": row[3],
        })
    
    conn.close()
    return {"results": results, "count": len(results)}

# ── ESS ENDPOINT ───────────────────────────────────────────────────
@app.get("/api/ess/{emp_id}")
async def ess_endpoint(emp_id: str):
    """Get employee's profile, leaves, attendance"""
    emp = get_employee_by_id(emp_id)
    if not emp:
        return {"error": "Employee not found", "emp_id": emp_id}
    
    conn = get_db()
    c = conn.cursor()
    
    # Get leaves
    c.execute('SELECT leave_id, leave_type, days, from_date, to_date, status FROM leaves WHERE emp_id = ? ORDER BY id DESC',
             (emp_id,))
    leave_history = [{"leave_id": row[0], "leave_type": row[1], "type": row[1], "days": row[2],
              "from_date": row[3], "to_date": row[4], "from": row[3], "to": row[4], "status": row[5]} for row in c.fetchall()]
    
    # Get attendance (last 10)
    c.execute('SELECT date, check_in, check_out, status FROM attendance WHERE emp_id = ? ORDER BY id DESC LIMIT 10',
             (emp_id,))
    attendance = [{"date": row[0], "check_in": row[1], "check_out": row[2], "status": row[3]} for row in c.fetchall()]

    c.execute('SELECT asset_id, asset_name, status FROM assets WHERE emp_id = ? ORDER BY id DESC', (emp_id,))
    assets = [{"asset_id": row[0], "asset_name": row[1], "status": row[2]} for row in c.fetchall()]

    c.execute('SELECT letter_id, letter_type, generated_on, status FROM hr_letters WHERE emp_id = ? ORDER BY id DESC', (emp_id,))
    hr_letters = [{"letter_id": row[0], "letter_type": row[1], "generated_on": row[2], "status": row[3]} for row in c.fetchall()]

    c.execute('SELECT leave_type, days_per_year FROM policies ORDER BY id')
    policies = c.fetchall()
    leave_balance = []
    for leave_type, total in policies:
        used = sum(l["days"] for l in leave_history if l["leave_type"] == leave_type and l["status"] == "Approved")
        leave_balance.append({
            "leave_type": leave_type,
            "total": total,
            "used": used,
            "remaining": max(total - used, 0),
        })
    
    conn.close()
    
    return {
        "emp_id": emp_id,
        "name": emp["name"],
        "profile": {
            "emp_id": emp_id,
            "name": emp["name"],
            "department": emp["department"],
            "designation": emp["designation"],
            "email": emp.get("email", ""),
            "status": emp["status"],
        },
        "leaves": leave_history,
        "leave_history": leave_history,
        "leave_balance": leave_balance,
        "attendance": attendance,
        "attendance_stats": {
            "present_days": len([a for a in attendance if a["status"] == "Present"]),
            "total_records": len(attendance),
        },
        "assets": assets,
        "hr_letters": hr_letters,
    }

@app.post("/api/ess/checkout/{emp_id}")
async def ess_checkout(emp_id: str):
    emp = get_employee_by_id(emp_id)
    if not emp:
        return {"success": False, "error": "Employee not found"}
    today = datetime.now().strftime("%d %b %Y")
    checkout = datetime.now().strftime("%I:%M %p")
    conn = get_db()
    c = conn.cursor()
    c.execute('''UPDATE attendance SET check_out = ?
                 WHERE emp_id = ? AND date = ? AND (check_out IS NULL OR check_out = '')''',
              (checkout, emp_id, today))
    if c.rowcount == 0:
        c.execute('''INSERT INTO attendance
                    (emp_id, emp_name, date, check_in, check_out, status, created_at)
                    VALUES (?, ?, ?, ?, ?, 'Present', ?)''',
                 (emp_id, emp["name"], today, "", checkout,
                  datetime.now().strftime("%d %b %Y %I:%M %p")))
    conn.commit()
    conn.close()
    backup_database_to_cloud()
    return {"success": True, "check_out": checkout}

# ── MSS ENDPOINT ───────────────────────────────────────────────────
@app.get("/api/mss/{manager_id}")
async def mss_endpoint(manager_id: str, department: str = ""):
    """Get manager's team data"""
    manager = get_employee_by_id(manager_id)
    if not manager:
        return {"error": "Manager not found"}
    if not any(word in (manager.get("designation") or "").lower() for word in ["manager", "lead", "head"]):
        return {"error": f"{manager['name']} is not marked as a manager. Use an employee with Manager/Lead/Head in designation."}
    
    conn = get_db()
    c = conn.cursor()
    today = datetime.now().strftime("%d %b %Y")
    
    # Get team
    dept_to_use = department or manager.get("department") or ""
    if department:
        c.execute('''SELECT emp_id, name, department, designation FROM employees 
                    WHERE status = 'Active' AND department LIKE ?''',
                 (f"%{dept_to_use}%",))
    else:
        c.execute('''SELECT emp_id, name, department, designation FROM employees 
                    WHERE status = "Active" AND department LIKE ?''',
                 (f"%{dept_to_use}%",))
    
    raw_team = c.fetchall()
    present_ids = set()
    c.execute('SELECT emp_id FROM attendance WHERE date = ? AND status = "Present"', (today,))
    for row in c.fetchall():
        present_ids.add(row[0])

    team_list = []
    absent_today = []
    for row in raw_team:
        attendance_status = "Present" if row[0] in present_ids else "Absent"
        item = {"emp_id": row[0], "name": row[1], "department": row[2],
                "designation": row[3], "status": "Active", "attendance_status": attendance_status}
        team_list.append(item)
        if attendance_status == "Absent":
            absent_today.append(item)
    
    # Get pending leaves
    c.execute('SELECT leave_id, emp_name, leave_type, days, status FROM leaves WHERE status = "Pending"')
    pending_leaves = [{"leave_id": row[0], "emp_name": row[1], "type": row[2],
                      "leave_type": row[2], "days": row[3], "status": row[4]} for row in c.fetchall()]
    
    conn.close()
    
    return {
        "manager_id": manager_id,
        "manager_name": manager["name"],
        "department": dept_to_use,
        "team": team_list,
        "team_count": len(team_list),
        "present_today": len([e for e in team_list if e["attendance_status"] == "Present"]),
        "absent_count": len(absent_today),
        "absent_today": absent_today,
        "pending_leaves": pending_leaves,
        "pending_count": len(pending_leaves),
    }

# ── ADMIN ENDPOINT ─────────────────────────────────────────────────
@app.get("/api/admin")
async def admin_endpoint():
    """Get all data for admin dashboard"""
    conn = get_db()
    c = conn.cursor()
    
    c.execute('SELECT emp_id, name, department, designation, status FROM employees')
    employees = [{"emp_id": row[0], "name": row[1], "department": row[2],
                 "designation": row[3], "status": row[4]} for row in c.fetchall()]
    
    c.execute('SELECT COUNT(*) FROM leaves')
    total_leaves = c.fetchone()[0]
    
    c.execute('SELECT COUNT(*) FROM assets')
    total_assets = c.fetchone()[0]
    
    conn.close()
    
    return {
        "employees": employees,
        "total_employees": len(employees),
        "active_employees": len([e for e in employees if e["status"] == "Active"]),
        "stats": {
            "total_employees": len(employees),
            "total_leaves": total_leaves,
            "total_assets": total_assets,
        }
    }

@app.get("/")
async def root():
    return {
        "status": "alive",
        "product": PRODUCT_NAME,
        "company": COMPANY_NAME,
        "database": "SQLite",
        "db_file": str(DB_FILE),
        "cloud_backup": "Upstash enabled" if cloud_backup_enabled() else "disabled",
    }

@app.get("/api/debug/db")
async def debug_database():
    """Quick health check to confirm what is actually saved in SQLite."""
    conn = get_db()
    c = conn.cursor()
    c.execute('SELECT emp_id, name, department, designation FROM employees ORDER BY id DESC LIMIT 10')
    employees = [{"emp_id": r[0], "name": r[1], "department": r[2], "designation": r[3]} for r in c.fetchall()]
    c.execute('SELECT leave_id, emp_name, leave_type, days, from_date, to_date, status FROM leaves ORDER BY id DESC LIMIT 10')
    leaves = [{"leave_id": r[0], "emp_name": r[1], "leave_type": r[2], "days": r[3], "from_date": r[4], "to_date": r[5], "status": r[6]} for r in c.fetchall()]
    conn.close()
    return {
        "db_file": str(DB_FILE),
        "cloud_backup": "Upstash enabled" if cloud_backup_enabled() else "disabled",
        "employee_count": len(employees),
        "recent_employees": employees,
        "recent_leaves": leaves,
    }


# ── LOGIN ENDPOINT ─────────────────────────────────────────────────
class LoginRequest(BaseModel):
    emp_id: str
    password: str

ROLE_PASSWORDS = {
    "hr":      os.environ.get("HR_PASSWORD",      "hr@1234"),
    "manager": os.environ.get("MANAGER_PASSWORD", "mgr@1234"),
    "admin":   os.environ.get("ADMIN_PASSWORD",   "admin@1234"),
}

@app.post("/api/login")
async def login_endpoint(payload: LoginRequest):
    emp_id   = payload.emp_id.strip().lower()
    password = payload.password.strip()

    if not emp_id or not password:
        return {"success": False, "message": "Please enter both ID and password."}

    # ── Role login (hr / manager / admin) ──
    if emp_id in ROLE_PASSWORDS:
        if password == ROLE_PASSWORDS[emp_id]:
            return {
                "success": True,
                "role":    emp_id,
                "name":    emp_id.upper(),
                "emp_id":  emp_id,
                "message": f"Welcome, {emp_id.upper()}!"
            }
        else:
            return {"success": False, "message": "Incorrect password. Please try again."}

    # ── Employee login — search by emp_id or name ──
    conn = get_db()
    c    = conn.cursor()

    # Try emp_id first (case-insensitive)
    c.execute('SELECT emp_id, name, department, designation FROM employees WHERE LOWER(emp_id) = ?', (emp_id,))
    row = c.fetchone()

    # Try name match if emp_id not found
    if not row:
        c.execute('SELECT emp_id, name, department, designation FROM employees WHERE LOWER(name) = ?', (emp_id,))
        row = c.fetchone()

    conn.close()

    if row:
        emp_id_val, name, dept, designation = row
        valid_passwords = ["emp@1234", emp_id_val.lower(), "password"]
        if password in valid_passwords:
            return {
                "success":     True,
                "role":        "employee",
                "name":        name,
                "emp_id":      emp_id_val,
                "department":  dept,
                "designation": designation,
                "message":     f"Welcome back, {name}!"
            }
        else:
            return {"success": False, "message": "Incorrect password. Default is emp@1234"}

    return {"success": False, "message": "Not found. Employees: use your EMP ID. HR/Manager/Admin: type your role name."}


print(f"\n{'='*60}")
print(f"✅ {PRODUCT_NAME} HR Assistant is ready")
print(f"📁 Database: {DB_FILE}")
print(f"{'='*60}\n")
