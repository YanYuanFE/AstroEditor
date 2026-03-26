import { useState, useEffect } from 'react'
import { useDialogStore } from '@/stores/dialog'
import {
    AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
    AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel,
} from '@/components/ui/alert-dialog'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function GlobalDialogs() {
    const { open, type, title, description, defaultValue, close } = useDialogStore()
    const [inputValue, setInputValue] = useState('')

    useEffect(() => {
        if (open && type === 'prompt') {
            setInputValue(defaultValue ?? '')
        }
    }, [open, type, defaultValue])

    if (type === 'prompt') {
        return (
            <Dialog open={open} onOpenChange={(v) => { if (!v) close(null) }}>
                <DialogContent className="sm:max-w-[380px]">
                    <DialogHeader>
                        <DialogTitle>{title}</DialogTitle>
                    </DialogHeader>
                    <Input
                        value={inputValue}
                        onChange={e => setInputValue(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') close(inputValue) }}
                        autoFocus
                    />
                    <DialogFooter>
                        <Button variant="outline" onClick={() => close(null)}>Cancel</Button>
                        <Button onClick={() => close(inputValue)}>OK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <AlertDialog open={open} onOpenChange={(v) => { if (!v) close(type === 'confirm' ? false : undefined) }}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>{title}</AlertDialogTitle>
                    {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
                </AlertDialogHeader>
                <AlertDialogFooter>
                    {type === 'confirm' && (
                        <AlertDialogCancel onClick={() => close(false)}>Cancel</AlertDialogCancel>
                    )}
                    <AlertDialogAction onClick={() => close(type === 'confirm' ? true : undefined)}>
                        OK
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
