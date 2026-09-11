import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { 
  GraduationCap, 
  BookOpen, 
  ClipboardCheck, 
  Download, 
  ExternalLink, 
  CheckCircle2, 
  ShieldCheck, 
  Smartphone, 
  Share2, 
  Check, 
  Sparkles
} from "lucide-react";
import { toast } from "sonner";

export type AppType = "student" | "teacher" | "staff";

interface AppDownloadPageProps {
  appType: AppType;
}

const appConfigs = {
  student: {
    type: "student" as const,
    title: "Sankalp Student App",
    badge: "Student Portal & Learning App",
    tagline: "Your all-in-one companion for classes, test series, study notes, teacher remarks, and academy notices.",
    apkPath: "/Sankalp_Student.apk",
    apkFileName: "Sankalp_Student.apk",
    webPath: "/student",
    version: "v1.2.0 Release",
    size: "4.1 MB",
    compatibility: "Android 8.0+",
    color: "from-cyan-500 to-blue-600",
    glowColor: "rgba(6, 182, 212, 0.25)",
    icon: GraduationCap,
    features: [
      { title: "Study Notes & PDFs", desc: "Access verified batch materials and lecture notes anytime offline." },
      { title: "Live Attendance", desc: "Check your subject-wise presence and attendance percentage instantly." },
      { title: "Tests & Instant Results", desc: "Take online batch tests and track your scores with analysis." },
      { title: "Teacher Remarks", desc: "View appreciations ⭐ and observation remarks ⚠️ directly from faculty." },
      { title: "Academy Notices", desc: "Receive immediate updates on schedules, holidays, and announcements." },
      { title: "AI Study Assistant", desc: "Get 24/7 instant answers to your academic queries powered by AI." }
    ]
  },
  teacher: {
    type: "teacher" as const,
    title: "Sankalp Teachers App",
    badge: "Faculty & Educator Portal",
    tagline: "Effortlessly manage lectures, mark daily batch attendance, share study notes, and provide student feedback.",
    apkPath: "/Sankalp_Teachers.apk",
    apkFileName: "Sankalp_Teachers.apk",
    webPath: "/teacher",
    version: "v1.2.0 Release",
    size: "4.1 MB",
    compatibility: "Android 8.0+",
    color: "from-teal-500 to-emerald-600",
    glowColor: "rgba(16, 185, 129, 0.25)",
    icon: BookOpen,
    features: [
      { title: "Lecture Scheduling", desc: "View today's upcoming lectures, timings, and assigned batches." },
      { title: "Fast Attendance Marking", desc: "Mark present/absent with 1-tap registers for all batch students." },
      { title: "Student Remarks System", desc: "Search any student and record appreciations or complaints." },
      { title: "Study Material Uploads", desc: "Distribute batch-specific notes, syllabus, and study resources." },
      { title: "Broadcast Notices", desc: "Publish urgent announcements and class alerts with real-time sync." },
      { title: "Real-time Firebase Sync", desc: "Instant offline-first synchronization across mobile and web." }
    ]
  },
  staff: {
    type: "staff" as const,
    title: "Sankalp Staff App",
    badge: "Administration & Operations App",
    tagline: "Streamline institute batch management, take daily attendance, and broadcast academy-wide notices.",
    apkPath: "/Sankalp_Staff.apk",
    apkFileName: "Sankalp_Staff.apk",
    webPath: "/staff",
    version: "v1.2.0 Release",
    size: "4.1 MB",
    compatibility: "Android 8.0+",
    color: "from-orange-500 to-amber-600",
    glowColor: "rgba(245, 158, 11, 0.25)",
    icon: ClipboardCheck,
    features: [
      { title: "Batch Attendance Register", desc: "Quick daily attendance capture across all institute batches." },
      { title: "Student Profiles", desc: "Look up student contact information, batch details, and records." },
      { title: "Institute Notices", desc: "Publish and manage urgent announcements and batch alerts." },
      { title: "High-Speed Sync", desc: "Automatic bidirectional syncing with the central database." },
      { title: "Lightweight & Fast", desc: "Smooth operation even on low-spec Android devices and networks." },
      { title: "Direct Web Portal Access", desc: "Seamless login on both mobile app and web browser." }
    ]
  }
};

const AppDownloadPage = ({ appType }: AppDownloadPageProps) => {
  const navigate = useNavigate();
  const config = appConfigs[appType] || appConfigs.student;
  const Icon = config.icon;
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    const toastId = toast.loading(`Preparing ${config.apkFileName}...`);
    
    // List of candidate paths where the APK is located
    const candidateUrls = [
      `/${config.apkFileName}`,
      `/downloads/${config.apkFileName}`,
      `./${config.apkFileName}`,
      `./downloads/${config.apkFileName}`,
      `/${appType}app/${config.apkFileName}`,
      `/${appType}/${config.apkFileName}`
    ];

    try {
      let binaryBlob: Blob | null = null;

      for (const url of candidateUrls) {
        try {
          const response = await fetch(url, { method: "GET", cache: "no-cache" });
          const contentType = (response.headers.get("content-type") || "").toLowerCase();
          
          // Verify that response is binary and not an SPA HTML fallback
          if (response.ok && !contentType.includes("text/html") && !contentType.includes("text/plain")) {
            const blob = await response.blob();
            if (blob.size > 50000) { // Real APK is ~4.3MB (never < 50KB)
              binaryBlob = blob;
              break;
            }
          }
        } catch {
          // try next path
        }
      }

      if (binaryBlob) {
        const apkBlob = new Blob([await binaryBlob.arrayBuffer()], { 
          type: "application/vnd.android.package-archive" 
        });
        const blobUrl = window.URL.createObjectURL(apkBlob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = config.apkFileName;
        a.setAttribute("type", "application/vnd.android.package-archive");
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60000);
        toast.success(`Download started: ${config.apkFileName} (${(apkBlob.size / (1024 * 1024)).toFixed(1)} MB)`, { id: toastId });
      } else {
        const a = document.createElement("a");
        a.href = `/${config.apkFileName}`;
        a.download = config.apkFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        toast.success(`Initiating download for ${config.apkFileName}...`, { id: toastId });
      }
    } catch {
      const a = document.createElement("a");
      a.href = `/${config.apkFileName}`;
      a.download = config.apkFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success(`Download started: ${config.apkFileName}`, { id: toastId });
    } finally {
      setIsDownloading(false);
    }
  };

  const handleCopyLink = () => {
    const fullUrl = window.location.href;
    navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    toast.success("Download link copied to clipboard!");
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex flex-col text-foreground selection:bg-primary/20">
      {/* Top Header */}
      <header className="border-b border-border/40 backdrop-blur-md bg-card/80 sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate("/")}>
            <img 
              src="./icons/sankalp_logo.jpeg" 
              alt="Sankalp Academy" 
              className="w-10 h-10 rounded-full object-cover border border-primary/20 shadow-md"
              onError={(e) => {
                (e.target as HTMLImageElement).src = "/icons/sankalp_logo.jpeg";
              }}
            />
            <div>
              <span className="font-extrabold text-base tracking-tight block leading-tight">Sankalp Academy</span>
              <span className="text-[11px] text-muted-foreground font-medium">Official Mobile Apps</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(config.webPath)}
              className="text-xs font-semibold rounded-xl gap-1.5"
            >
              <span>Web Portal</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl mx-auto px-4 py-10 w-full">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-10">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary animate-in fade-in">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>{config.badge}</span>
            <span className="opacity-40">•</span>
            <span>{config.version}</span>
          </div>

          {/* App Icon Glow */}
          <div className="relative inline-block my-2">
            <div 
              className="absolute inset-0 rounded-3xl blur-2xl opacity-60 transform scale-110 -z-10"
              style={{ backgroundColor: config.glowColor }}
            />
            <div className={`w-24 h-24 rounded-3xl bg-gradient-to-br ${config.color} flex items-center justify-center shadow-2xl mx-auto border-2 border-white/20 transform hover:scale-105 transition-transform duration-300`}>
              <Icon className="h-12 w-12 text-white" />
            </div>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black tracking-tight text-foreground">
            {config.title}
          </h1>

          <p className="text-base sm:text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
            {config.tagline}
          </p>

          {/* Key Specs Pills */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-xs font-semibold text-muted-foreground">
            <span className="px-3 py-1 rounded-lg bg-card border border-border/60">📦 APK Size: <strong>{config.size}</strong></span>
            <span className="px-3 py-1 rounded-lg bg-card border border-border/60">📱 OS: <strong>{config.compatibility}</strong></span>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" /> 100% Virus Free
            </span>
          </div>
        </div>

        {/* Primary Download & Action Card */}
        <Card className="p-5 sm:p-8 rounded-3xl border-2 border-primary/20 shadow-xl bg-card/80 backdrop-blur-xl max-w-2xl mx-auto mb-12">
          <div className="flex flex-col sm:flex-row gap-4">
            <button
              type="button"
              disabled={isDownloading}
              onClick={handleDownload}
              className={`flex-1 min-h-[5rem] sm:min-h-[5.25rem] py-4 px-5 sm:px-6 rounded-2xl bg-gradient-to-r ${config.color} hover:opacity-95 text-white font-black shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3.5 sm:gap-4 cursor-pointer disabled:opacity-75`}
            >
              <div className="p-2 sm:p-2.5 rounded-xl bg-white/20 backdrop-blur-sm shrink-0 flex items-center justify-center shadow-inner">
                <Download className={`h-6 w-6 sm:h-7 sm:w-7 ${isDownloading ? 'animate-spin' : 'animate-bounce'}`} />
              </div>
              <div className="text-left flex-1 min-w-0">
                <div className="text-[11px] sm:text-xs font-semibold tracking-wider uppercase opacity-90 mb-1 leading-none">
                  {isDownloading ? "Downloading Binary APK..." : "Download Official Android APK"}
                </div>
                <div className="text-base sm:text-lg font-black tracking-tight leading-tight flex items-center flex-wrap gap-x-1.5">
                  <span>{config.apkFileName}</span>
                  <span className="text-xs sm:text-sm font-medium opacity-90">({config.size})</span>
                </div>
              </div>
            </button>

            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate(config.webPath)}
              className="min-h-[3.75rem] sm:min-h-[5.25rem] py-4 px-6 rounded-2xl border-2 hover:bg-muted font-bold text-sm sm:text-base flex items-center justify-center gap-2.5"
            >
              <ExternalLink className="h-5 w-5 shrink-0" />
              <span>Open Web Portal</span>
            </Button>
          </div>

          {/* Direct Mirrors & Share */}
          <div className="mt-5 pt-4 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start">
              <span className="flex items-center gap-1 font-semibold">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Direct links:
              </span>
              <a 
                href={`/${config.apkFileName}`} 
                download={config.apkFileName} 
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-mono font-bold transition-colors"
              >
                /{config.apkFileName}
              </a>
              <a 
                href={`/downloads/${config.apkFileName}`} 
                download={config.apkFileName} 
                className="px-2.5 py-1 rounded-lg bg-muted hover:bg-muted/80 text-foreground font-mono font-bold transition-colors"
              >
                /downloads/{config.apkFileName}
              </a>
            </div>

            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 hover:text-foreground font-semibold py-1 px-2.5 rounded-lg hover:bg-muted/60 transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Share2 className="h-4 w-4" />}
              <span>{copied ? "Copied!" : "Share Link"}</span>
            </button>
          </div>
        </Card>

        {/* Features Grid */}
        <div className="mb-14">
          <div className="text-center mb-8">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Key App Features</h2>
            <p className="text-sm text-muted-foreground mt-1">Built specifically for Sankalp Academy students & faculty</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {config.features.map((feature, idx) => (
              <Card key={idx} className="p-5 rounded-2xl border border-border/50 bg-card/60 hover:border-primary/40 hover:shadow-md transition-all">
                <div className="flex items-start gap-3.5">
                  <div className={`p-2 rounded-xl bg-gradient-to-br ${config.color} text-white shrink-0 mt-0.5 shadow-sm`}>
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground mb-1">{feature.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        {/* 3-Step Installation Guide */}
        <Card className="p-6 sm:p-8 rounded-3xl border border-border/60 bg-card/60 backdrop-blur-md mb-14">
          <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <span>How to Install on Android in 3 Simple Steps</span>
          </h2>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-2 p-4 rounded-2xl bg-muted/40 border border-border/40">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shadow-md">
                1
              </div>
              <h4 className="font-bold text-sm">Download APK</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Click the Download button above. If browser warns about file security, tap <strong>"Download anyway"</strong>.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-muted/40 border border-border/40">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shadow-md">
                2
              </div>
              <h4 className="font-bold text-sm">Allow Unknown Apps</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                If prompted during installation, enable <strong>"Allow from this source"</strong> in your phone settings.
              </p>
            </div>

            <div className="space-y-2 p-4 rounded-2xl bg-muted/40 border border-border/40">
              <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground font-black text-sm flex items-center justify-center shadow-md">
                3
              </div>
              <h4 className="font-bold text-sm">Open & Log In</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Tap <strong>Install</strong>, launch the app from your home screen, and sign in with your academy account.
              </p>
            </div>
          </div>
        </Card>

        {/* Other Sankalp Apps Switcher */}
        <div className="p-6 rounded-3xl bg-muted/30 border border-border/50 text-center">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">
            Download Other Sankalp Academy Apps
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {appType !== "student" && (
              <Button 
                variant="outline" 
                className="h-12 px-5 rounded-xl text-xs sm:text-sm font-bold gap-2.5"
                onClick={() => navigate("/studentapp")}
              >
                <GraduationCap className="h-4 w-4 text-cyan-500" />
                <span>Student App (APK)</span>
              </Button>
            )}

            {appType !== "teacher" && (
              <Button 
                variant="outline" 
                className="h-12 px-5 rounded-xl text-xs sm:text-sm font-bold gap-2.5"
                onClick={() => navigate("/teachersapp")}
              >
                <BookOpen className="h-4 w-4 text-emerald-500" />
                <span>Teachers App (APK)</span>
              </Button>
            )}

            {appType !== "staff" && (
              <Button 
                variant="outline" 
                className="h-12 px-5 rounded-xl text-xs sm:text-sm font-bold gap-2.5"
                onClick={() => navigate("/staffapp")}
              >
                <ClipboardCheck className="h-4 w-4 text-amber-500" />
                <span>Staff App (APK)</span>
              </Button>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Sankalp Academy. All rights reserved.</p>
      </footer>
    </div>
  );
};

export default AppDownloadPage;
