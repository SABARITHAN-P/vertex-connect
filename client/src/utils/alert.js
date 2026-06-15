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
 */
export const premiumAlert = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    buttonsStyling: false,
    customClass: swalCustomClass,
    heightAuto: false,
  });
};

/**
 * Premium replacement for standard window.confirm
 * @param {string} title - The confirmation title
 * @param {string} text - The detail message
 * @returns {Promise<boolean>} Resolves to true if confirmed, false otherwise
 */
export const premiumConfirm = (title, text = "") => {
  return Swal.fire({
    title,
    text,
    showCancelButton: true,
    confirmButtonText: "Confirm",
    cancelButtonText: "Cancel",
    background: "var(--bg-modal)",
    color: "var(--text-primary)",
    buttonsStyling: false,
    customClass: swalCustomClass,
    heightAuto: false,
  }).then((result) => !!result.isConfirmed);
};
