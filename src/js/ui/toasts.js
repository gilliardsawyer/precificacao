import { CONFIG } from "../core/config.js";

export function showNotification(message, type = "success", duration = CONFIG.UI.NOTIFICATION_DURATION_MS) {
  const notification = document.createElement("div");
  notification.className = `notification notification-${type}`;
  notification.setAttribute("role", "status");
  notification.setAttribute("aria-live", "polite");
  notification.textContent = message;
  
  Object.assign(notification.style, {
    position: "fixed",
    top: "20px",
    right: "20px",
    padding: "12px 20px",
    borderRadius: "4px",
    zIndex: 9999,
    maxWidth: "300px",
    wordBreak: "break-word"
  });
  
  const colors = {
    success: { bg: "#d4edda", color: "#155724", border: "#c3e6cb" },
    error: { bg: "#f8d7da", color: "#721c24", border: "#f5c6cb" },
    info: { bg: "#d1ecf1", color: "#0c5460", border: "#bee5eb" },
    warning: { bg: "#fff3cd", color: "#856404", border: "#ffeaa7" }
  };
  
  const style = colors[type] || colors.info;
  Object.assign(notification.style, {
    backgroundColor: style.bg,
    color: style.color,
    border: `1px solid ${style.border}`
  });
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = "0";
    notification.style.transition = "opacity 0.3s";
    setTimeout(() => notification.remove(), 300);
  }, duration);
}
