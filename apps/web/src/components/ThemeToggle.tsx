"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined") {
      setDark(document.documentElement.classList.contains("dark"));
    }
  }, []);

  const toggleTheme = () => {
    if (typeof window === "undefined") return;
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setDark(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setDark(true);
    }
  };

  useEffect(() => {
    if (!mounted) return;
    const theme = localStorage.getItem("theme");
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
      setDark(true);
    } else {
      document.documentElement.classList.remove("dark");
      setDark(false);
    }
  }, [mounted]);

  if (!mounted) return null;

  return (
    <Button variant="outline" size="sm" onClick={toggleTheme}>
      {dark ? "Light Mode" : "Dark Mode"}
    </Button>
  );
}
