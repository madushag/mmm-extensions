// Function to show a toast notification. Include a fade out duration parameter in seconds
type ToastType = "success" | "error" | "warning" | "info";

export function showToast(message: string, type: ToastType = "success", fadeOutDuration: number = 3): void {
    const toast = document.createElement("div");
    toast.className = `toast-notification toast-${type}`;
    toast.innerText = message;

    // Add the toast to the body
    document.body.appendChild(toast);

    // Fade out the toast after the specified duration
    setTimeout(() => {
        toast.style.opacity = "0";
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 1000);
    }, fadeOutDuration * 1000);
}
