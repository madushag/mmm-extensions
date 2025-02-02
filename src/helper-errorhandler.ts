import { showToast } from "./toast.js";

export function handleGlobalError(error: Error, context: string) {
    showToast(`Error in ${context}: ${error.message}`, "error");
    document.dispatchEvent(new CustomEvent('SEND_TO_GANALYTICS_ERROR', { 
        detail: { 
            eventName: "global_error",
            context: context,
            error: error.message
        } 
    }));
} 