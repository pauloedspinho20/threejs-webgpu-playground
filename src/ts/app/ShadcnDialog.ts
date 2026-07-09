export interface DialogOptions {
  title: string;
  text?: string;
  html?: string;
  icon?: "success" | "warning" | "info" | "error";
  confirmButtonText?: string;
  showConfirmButton?: boolean;
  footer?: string;
}

const svgWarning = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-alert-triangle"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>`;
const svgSuccess = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check-circle"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>`;

export class ShadcnDialog {
  static fire(options: DialogOptions): Promise<void> {
    return new Promise((resolve) => {
      // Create overlay
      const overlay = document.createElement("div");
      overlay.className =
        "fixed inset-0 z-50 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out fade-in-0 fade-out-0";
      overlay.setAttribute("data-state", "open");

      // Create dialog container
      const dialog = document.createElement("div");
      dialog.className =
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-md translate-x-[-50%] translate-y-[-50%] gap-4 backdrop-blur-xl p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg";
      dialog.setAttribute("data-state", "open");

      let iconSvg = "";
      if (options.icon === "warning") {
        iconSvg = `<div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-destructive/20 mb-4 text-white">${svgWarning}</div>`;
      } else if (options.icon === "success") {
        iconSvg = `<div class="mx-auto flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 mb-4 text-white">${svgSuccess}</div>`;
      }

      let contentHtml = "";
      if (options.html) {
        contentHtml = `<div class="text-sm text-white">${options.html}</div>`;
      } else if (options.text) {
        contentHtml = `<p class="text-sm text-white">${options.text}</p>`;
      }

      let footerHtml = "";
      if (options.footer) {
        footerHtml = `<div class="text-xs text-center text-white">${options.footer}</div>`;
      }

      let buttonHtml = "";
      const showBtn = options.showConfirmButton !== false;
      if (showBtn) {
        const btnText = options.confirmButtonText || "OK";
        buttonHtml = `
					<div class="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
						<button id="dialog-confirm-btn" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm w-full font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
							${btnText}
						</button>
					</div>
				`;
      }

      dialog.innerHTML = `
				<div class="flex flex-col text-center sm:text-left">
					${iconSvg}
					<h2 class="text-xl font-semibold leading-none tracking-tight text-white mb-6">${options.title}</h2>
					${contentHtml}
				</div>
				${buttonHtml}
				${footerHtml}
			`;

      const closeDialog = () => {
        overlay.setAttribute("data-state", "closed");
        dialog.setAttribute("data-state", "closed");
        setTimeout(() => {
          document.body.removeChild(overlay);
          document.body.removeChild(dialog);
          resolve();
        }, 200);
      };

      if (showBtn) {
        const btn = dialog.querySelector("#dialog-confirm-btn");
        btn?.addEventListener("click", closeDialog);
      }

      // Close on overlay click if no button is required or it's just an info popup
      if (!showBtn) {
        overlay.addEventListener("click", closeDialog);
      }

      document.body.appendChild(overlay);
      document.body.appendChild(dialog);
    });
  }
}
