import { create } from 'zustand'

type DialogType = 'confirm' | 'alert' | 'prompt'

interface DialogState {
    open: boolean
    type: DialogType
    title: string
    description?: string
    defaultValue?: string
    resolve: ((value: any) => void) | null
}

interface DialogStore extends DialogState {
    confirm: (title: string, description?: string) => Promise<boolean>
    alert: (title: string, description?: string) => Promise<void>
    prompt: (title: string, defaultValue?: string) => Promise<string | null>
    close: (value: any) => void
}

export const useDialogStore = create<DialogStore>()((set, get) => ({
    open: false,
    type: 'confirm',
    title: '',
    description: undefined,
    defaultValue: undefined,
    resolve: null,

    confirm: (title, description) =>
        new Promise<boolean>(resolve => {
            set({ open: true, type: 'confirm', title, description, defaultValue: undefined, resolve })
        }),

    alert: (title, description) =>
        new Promise<void>(resolve => {
            set({ open: true, type: 'alert', title, description, defaultValue: undefined, resolve })
        }),

    prompt: (title, defaultValue) =>
        new Promise<string | null>(resolve => {
            set({ open: true, type: 'prompt', title, description: undefined, defaultValue, resolve })
        }),

    close: (value) => {
        const { resolve } = get()
        resolve?.(value)
        set({ open: false, resolve: null })
    },
}))
