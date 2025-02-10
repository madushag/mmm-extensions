/******************************************************************************************/
/* This file provides toast notification functionality for the extension.
/* It allows showing temporary pop-up messages to users with different types:
/* - success, error, warning, and info notifications
/* - customizable fade-out duration
/* - automatic cleanup of DOM elements
/******************************************************************************************/

export enum ToastType {
	SUCCESS = "success",
	ERROR = "error",
	WARNING = "warning",
	INFO = "info"
}

export function showToast(message: string, type: ToastType = ToastType.SUCCESS, fadeOutDuration: number = 3): void {
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
