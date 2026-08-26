import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button.js";

export default function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="font-display text-3xl font-bold text-brand">٤٠٤</h1>
      <p className="text-ink-muted">الصفحة غير موجودة</p>
      <Link to="/app">
        <Button>العودة إلى لوحة التحكم</Button>
      </Link>
    </div>
  );
}
