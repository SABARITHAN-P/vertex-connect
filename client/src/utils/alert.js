import Swal from "sweetalert2";
import "sweetalert2/dist/sweetalert2.min.css";

const swalCustomClass = {
  popup: "premium-swal-popup",
  title: "premium-swal-title",
  htmlContainer: "premium-swal-html",
  confirmButton: "premium-swal-confirm",
  cancelButton: "premium-swal-cancel",
  actions: "premium-swal-actions"
};

/**
 * Premium replacement for standard window.alert
 * @param {string} title - The title of the alert
 * @param {string} text - The detail message of the alert
 * @param {"success"|"error"|"warning"|"info"|"question"} icon - The type of icon to display
 */
export const premiumAlert = (title, text = "", icon = "info") => {
  return Swal.fire({
    title,
    text,
    icon,
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    buttonsStyling: false,
    customClass: swalCustomClass,
  });
};

/**
 * Premium replacement for standard window.confirm
 * @param {string} title - The confirmation title
 * @param {string} text - The detail message
 * @param {"success"|"error"|"warning"|"info"|"question"} icon - Icon type
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise
 */
export const premiumConfirm = (title, text = "", icon = "warning") => {
  return Swal.fire({
    title,
    text,
    icon,
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    buttonsStyling: false,
    customClass: swalCustomClass,
  }).then((result) => !!result.isConfirmed);
};
