class ModalManager {
    constructor() {
        this.activeModals = new Set();
        this.setupGlobalListeners();
    }

    setupGlobalListeners() {
        // Handle escape key to close modals
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeTopModal();
            }
        });

        // Handle backdrop clicks
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-backdrop')) {
                this.closeModal(e.target.querySelector('.modal-content').dataset.modalId);
            }
        });
    }

    showModal(options) {
        const {
            id,
            title,
            content,
            buttons = [],
            className = '',
            closable = true,
            backdrop = true
        } = options;

        // Remove existing modal with same ID
        this.closeModal(id);

        // Create modal HTML
        const modalHTML = `
            <div class="modal-backdrop ${backdrop ? 'with-backdrop' : ''}" data-modal-id="${id}">
                <div class="modal-content ${className}" data-modal-id="${id}">
                    <div class="modal-header">
                        <h3 class="modal-title">${title}</h3>
                        ${closable ? '<button class="modal-close" data-action="close">✕</button>' : ''}
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${buttons.length > 0 ? `
                        <div class="modal-footer">
                            ${buttons.map(btn => `
                                <button class="modal-btn ${btn.className || ''}" 
                                        data-action="${btn.action}"
                                        ${btn.primary ? 'data-primary="true"' : ''}>
                                    ${btn.text}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Add to DOM
        const modalElement = document.createElement('div');
        modalElement.innerHTML = modalHTML;
        modalElement.className = 'modal-wrapper';
        modalElement.dataset.modalId = id;
        document.body.appendChild(modalElement);

        // Setup event listeners
        modalElement.addEventListener('click', (e) => {
            const action = e.target.dataset.action;
            if (action === 'close') {
                this.closeModal(id);
            } else if (action && options.onAction) {
                options.onAction(action, e.target);
            }
        });

        // Track active modal
        this.activeModals.add(id);

        // Focus management
        setTimeout(() => {
            const firstInput = modalElement.querySelector('input, textarea, button');
            if (firstInput) firstInput.focus();
        }, 100);

        return modalElement;
    }

    closeModal(id) {
        const modal = document.querySelector(`[data-modal-id="${id}"]`);
        if (modal) {
            modal.remove();
            this.activeModals.delete(id);
        }
    }

    closeTopModal() {
        if (this.activeModals.size > 0) {
            const lastModal = Array.from(this.activeModals).pop();
            this.closeModal(lastModal);
        }
    }

    showAlert(message, type = 'info') {
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        return this.showModal({
            id: `alert-${Date.now()}`,
            title: `${icons[type]} ${type.charAt(0).toUpperCase() + type.slice(1)}`,
            content: `<p class="alert-message">${message}</p>`,
            buttons: [
                { text: 'OK', action: 'close', primary: true }
            ],
            className: `alert-modal alert-${type}`
        });
    }

    showConfirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            this.showModal({
                id: `confirm-${Date.now()}`,
                title: title,
                content: `<p class="confirm-message">${message}</p>`,
                buttons: [
                    { text: 'Cancel', action: 'cancel' },
                    { text: 'OK', action: 'confirm', primary: true }
                ],
                className: 'confirm-modal',
                onAction: (action) => {
                    resolve(action === 'confirm');
                    this.closeModal(`confirm-${Date.now()}`);
                }
            });
        });
    }
}

window.ModalManager = ModalManager;
