import * as React from "react"
import { Moon, Sun } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

function getTheme(): "light" | "dark" {
    if (typeof window === "undefined") return "dark"
    return document.documentElement.classList.contains("dark") ? "dark" : "light"
}

function setTheme(theme: "light" | "dark" | "system") {
    const resolved =
        theme === "system"
            ? window.matchMedia("(prefers-color-scheme: dark)").matches
                ? "dark"
                : "light"
            : theme
    document.documentElement.classList.toggle("dark", resolved === "dark")
    localStorage.setItem("theme", theme)
}

export function ModeToggle() {
    const [, forceUpdate] = React.useReducer((x: number) => x + 1, 0)

    React.useEffect(() => {
        const saved = localStorage.getItem("theme") as "light" | "dark" | "system" | null
        if (saved) setTheme(saved)
    }, [])

    const handleSetTheme = (theme: "light" | "dark" | "system") => {
        setTheme(theme)
        forceUpdate()
    }

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className={'h-9'}>
                    <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                    <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleSetTheme("light")}>
                    Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetTheme("dark")}>
                    Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleSetTheme("system")}>
                    System
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
