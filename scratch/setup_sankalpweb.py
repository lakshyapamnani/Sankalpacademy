import os
import shutil

# Paths to built files
admin_exe_source = r"c:\Users\LAKSHYA\SankalpAcademy\release\1.0.0\Sankalp Academy ERP Setup 1.0.0.exe"

teacher_apk_source = r"c:\Users\LAKSHYA\SankalpAcademy\SankalpTeachers\android\app\build\outputs\apk\release\app-release.apk"
teacher_aab_source = r"c:\Users\LAKSHYA\SankalpAcademy\SankalpTeachers\android\app\build\outputs\bundle\release\app-release.aab"

student_apk_source = r"c:\Users\LAKSHYA\SankalpAcademy\android\app\build\outputs\apk\release\app-release.apk"
student_aab_source = r"c:\Users\LAKSHYA\SankalpAcademy\android\app\build\outputs\bundle\release\app-release.aab"

logo_source = r"c:\Users\LAKSHYA\SankalpAcademy\public\icons\sankalp_logo.jpeg"

# Target directories
target_dir_1 = r"c:\Users\LAKSHYA\SankalpAcademy\sankalpweb"
target_dir_2 = r"c:\Users\LAKSHYA\sankalpweb"

for tdir in [target_dir_1, target_dir_2]:
    os.makedirs(tdir, exist_ok=True)
    print(f"Copying files into {tdir}...")

    # Copy Admin setup exe
    if os.path.exists(admin_exe_source):
        shutil.copy2(admin_exe_source, os.path.join(tdir, "Sankalp_Admin_Setup.exe"))
        print("Copied Admin setup .exe")

    # Copy Teachers apk & aab
    if os.path.exists(teacher_apk_source):
        shutil.copy2(teacher_apk_source, os.path.join(tdir, "Sankalp_Teachers.apk"))
        print("Copied Teachers .apk")
    if os.path.exists(teacher_aab_source):
        shutil.copy2(teacher_aab_source, os.path.join(tdir, "Sankalp_Teachers.aab"))
        print("Copied Teachers .aab")

    # Copy Student apk & aab
    if os.path.exists(student_apk_source):
        shutil.copy2(student_apk_source, os.path.join(tdir, "Sankalp_Student.apk"))
        print("Copied Student .apk")
    if os.path.exists(student_aab_source):
        shutil.copy2(student_aab_source, os.path.join(tdir, "Sankalp_Student.aab"))
        print("Copied Student .aab")

    # Copy logo
    if os.path.exists(logo_source):
        shutil.copy2(logo_source, os.path.join(tdir, "sankalp_logo.jpeg"))
        print("Copied Logo")

    # Create index.html
    html_content = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sankalp Academy - Download Apps</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #0ea5e9;
      --bg: #0f172a;
      --card-bg: rgba(30, 41, 59, 0.75);
      --card-border: rgba(255, 255, 255, 0.1);
      --text: #f8fafc;
      --text-muted: #94a3b8;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }

    body {
      background: radial-gradient(circle at 50% 0%, #1e1b4b 0%, #0f172a 75%);
      color: var(--text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1rem;
    }

    .container {
      max-width: 1100px;
      width: 100%;
    }

    header {
      text-align: center;
      margin-bottom: 3.5rem;
    }

    .logo-img {
      width: 100px;
      height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 4px solid rgba(14, 165, 233, 0.3);
      box-shadow: 0 0 30px rgba(14, 165, 233, 0.4);
      margin-bottom: 1.5rem;
    }

    h1 {
      font-size: 2.75rem;
      font-weight: 800;
      background: linear-gradient(135deg, #38bdf8, #818cf8);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
    }

    p.subtitle {
      font-size: 1.15rem;
      color: var(--text-muted);
      max-width: 600px;
      margin: 0 auto;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 2rem;
      margin-bottom: 4rem;
    }

    .card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--card-border);
      border-radius: 24px;
      padding: 2.25rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .card::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: 4px;
      background: linear-gradient(90deg, var(--card-gradient-start), var(--card-gradient-end));
    }

    .card.admin {
      --card-gradient-start: #a855f7;
      --card-gradient-end: #ec4899;
    }

    .card.teacher {
      --card-gradient-start: #14b8a6;
      --card-gradient-end: #10b981;
    }

    .card.student {
      --card-gradient-start: #0ea5e9;
      --card-gradient-end: #6366f1;
    }

    .card:hover {
      transform: translateY(-8px);
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4), 0 0 20px rgba(14, 165, 233, 0.1);
      border-color: rgba(255, 255, 255, 0.25);
    }

    .icon-wrapper {
      width: 64px;
      height: 64px;
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.5rem;
      font-size: 2rem;
    }

    .card.admin .icon-wrapper { background: rgba(168, 85, 247, 0.15); color: #c084fc; }
    .card.teacher .icon-wrapper { background: rgba(20, 184, 166, 0.15); color: #2dd4bf; }
    .card.student .icon-wrapper { background: rgba(14, 165, 233, 0.15); color: #38bdf8; }

    .card h2 {
      font-size: 1.6rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
    }

    .card .platform-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 1rem;
    }

    .card.admin .platform-badge { background: rgba(168, 85, 247, 0.2); color: #e9d5ff; }
    .card.teacher .platform-badge { background: rgba(20, 184, 166, 0.2); color: #ccfbf1; }
    .card.student .platform-badge { background: rgba(14, 165, 233, 0.2); color: #e0f2fe; }

    .card p.desc {
      color: var(--text-muted);
      font-size: 0.95rem;
      line-height: 1.6;
      margin-bottom: 1.75rem;
      flex-grow: 1;
    }

    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.9rem 1.5rem;
      border-radius: 14px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
      font-size: 0.95rem;
    }

    .btn-primary {
      color: #ffffff;
      box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
    }

    .card.admin .btn-primary { background: linear-gradient(135deg, #9333ea, #c084fc); }
    .card.teacher .btn-primary { background: linear-gradient(135deg, #0d9488, #14b8a6); }
    .card.student .btn-primary { background: linear-gradient(135deg, #0284c7, #38bdf8); }

    .btn-primary:hover {
      filter: brightness(1.1);
      transform: scale(1.02);
    }

    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid rgba(255, 255, 255, 0.1);
    }

    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text);
    }

    footer {
      text-align: center;
      color: var(--text-muted);
      font-size: 0.9rem;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      padding-top: 2rem;
      width: 100%;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <img src="sankalp_logo.jpeg" alt="Sankalp Academy Logo" class="logo-img">
      <h1>Sankalp Academy Applications</h1>
      <p class="subtitle">Download official applications for Admin Desktop, Teachers Portal, and Student Platform.</p>
    </header>

    <div class="grid">
      <!-- STUDENT CARD -->
      <div class="card student">
        <div>
          <div class="icon-wrapper">🎓</div>
          <span class="platform-badge">Android Mobile / Tablet</span>
          <h2>Sankalp Student</h2>
          <p class="desc">Student dashboard for lecture schedules, attendance tracking, notes access, AI learning assistance, and online tests.</p>
        </div>
        <div class="btn-group">
          <a href="Sankalp_Student.apk" class="btn btn-primary" download>
            <span>Download Student APK</span>
          </a>
          <a href="Sankalp_Student.aab" class="btn btn-secondary" download>
            <span>Download Bundle (.aab)</span>
          </a>
        </div>
      </div>

      <!-- TEACHERS CARD -->
      <div class="card teacher">
        <div>
          <div class="icon-wrapper">👨‍🏫</div>
          <span class="platform-badge">Android Mobile / Tablet</span>
          <h2>Sankalp Teachers</h2>
          <p class="desc">Faculty portal for marking student attendance, uploading notes, conducting lectures, and creating MCQ tests.</p>
        </div>
        <div class="btn-group">
          <a href="Sankalp_Teachers.apk" class="btn btn-primary" download>
            <span>Download Teachers APK</span>
          </a>
          <a href="Sankalp_Teachers.aab" class="btn btn-secondary" download>
            <span>Download Bundle (.aab)</span>
          </a>
        </div>
      </div>

      <!-- ADMIN CARD -->
      <div class="card admin">
        <div>
          <div class="icon-wrapper">💻</div>
          <span class="platform-badge">Windows Desktop (.exe)</span>
          <h2>Admin ERP Setup</h2>
          <p class="desc">Complete management suite for class administration, student & batch management, fee records, and system analytics.</p>
        </div>
        <div class="btn-group">
          <a href="Sankalp_Admin_Setup.exe" class="btn btn-primary" download>
            <span>Download Admin Setup (.exe)</span>
          </a>
        </div>
      </div>
    </div>

    <footer>
      <p>&copy; 2026 Sankalp Academy. All rights reserved.</p>
    </footer>
  </div>
</body>
</html>
"""
    with open(os.path.join(tdir, "index.html"), "w", encoding="utf-8") as f:
        f.write(html_content)
    print("Created index.html")

print("sankalpweb setup finished!")
