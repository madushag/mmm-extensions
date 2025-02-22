/******************************************************************************************/
/* This file provides toast notification functionality for the extension.
/* It allows showing temporary pop-up messages to users with different types:
/* - success, error, warning, and info notifications
/* - customizable fade-out duration
/* - automatic cleanup of DOM elements
/* - stackable notifications with FIFO behavior
/******************************************************************************************/

export enum ToastType {
	SUCCESS = "success",
	ERROR = "error",
	WARNING = "warning",
	INFO = "info"
}

let toastContainer: HTMLDivElement | null = null;

function ensureContainer(): HTMLDivElement {
	if (!toastContainer) {
		toastContainer = document.createElement("div");
		toastContainer.className = "toast-container";
		document.body.appendChild(toastContainer);
	}
	return toastContainer;
}

export function showToast(message: string, type: ToastType = ToastType.SUCCESS, fadeOutDuration: number = 3): void {
	const container = ensureContainer();
	const toast = document.createElement("div");
	toast.className = `toast-notification toast-${type}`;
	toast.innerText = message;
	container.appendChild(toast);

	// Force reflow to trigger animation
	void toast.offsetWidth;
	toast.classList.add("show");

	window.setTimeout(() => {
		toast.classList.add("hide");
		window.setTimeout(() => {
			if (container.contains(toast)) {
				container.removeChild(toast);
			}
			// Remove container if it's empty
			if (container.childNodes.length === 0) {
				document.body.removeChild(container);
				toastContainer = null;
			}
		}, 300);
	}, fadeOutDuration * 1000);
}
