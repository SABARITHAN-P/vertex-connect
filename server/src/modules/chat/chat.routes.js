const express = require("express");
const router = express.Router();

const {
   accessChat,
   getChats,
   createGroupChat,
   updateGroupInfo,
   updateGroupAvatar,
   removeGroupAvatar,
   addToGroup,
   removeFromGroup,
   leaveGroup,
   updateMemberRole,
   transferOwnership,
   joinGroupByCode,
   deleteGroupChat,
   updateGroupRules,
   deleteChat,
   clearChat,
   toggleArchiveChat,
   togglePinChat,
   lockChat,
   unlockChat,
   toggleMarkUnread,
   getChatPermissions,
} = require("./chat.controller");

const protect = require("../../middleware/authMiddleware");
const upload = require("../../middleware/uploadMiddleware");

/* =========================================================
   1-ON-1 DM CHATS
========================================================= */
router.post("/", protect, accessChat);
router.get("/", protect, getChats);
router.get("/permissions/:chatId", protect, getChatPermissions);
router.delete("/:chatId", protect, deleteChat);
router.post("/clear/:chatId", protect, clearChat);
router.post("/archive/:chatId", protect, toggleArchiveChat);
router.post("/pin/:chatId", protect, togglePinChat);
router.post("/lock/:chatId", protect, lockChat);
router.post("/unlock/:chatId", protect, unlockChat);
router.post("/mark-unread/:chatId", protect, toggleMarkUnread);

/* =========================================================
   GROUP CHATS MANAGEMENT & MEMBERSHIP
========================================================= */
router.post("/group", protect, createGroupChat);
router.delete("/group", protect, deleteGroupChat);
router.put("/group/rules", protect, updateGroupRules);
router.put("/group/info", protect, updateGroupInfo);
router.put("/group/avatar", protect, upload.single("avatar"), updateGroupAvatar);
router.delete("/group/avatar", protect, removeGroupAvatar);

router.post("/group/add", protect, addToGroup);
router.post("/group/remove", protect, removeFromGroup);
router.post("/group/leave", protect, leaveGroup);

router.put("/group/role", protect, updateMemberRole);
router.put("/group/transfer", protect, transferOwnership);
router.post("/group/join/:inviteCode", protect, joinGroupByCode);

module.exports = router;
