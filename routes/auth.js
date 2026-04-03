const express = require('express')
const router = express.Router()
const { register, login } = require('../controllers/auth')  
const auth = require('../middleware/authentication')
const authorize = require('../middleware/authrize')


router.post("/register", register)
router.post("/login", login)
router.get("/profile", auth, (req, res) => {
  res.json({
    msg: "Welcome user",
    user: req.user
  });
});

router.get("/admin", auth, authorize("admin"), (req, res) => {
  res.json({ msg: "Welcome Admin" });
});

router.get("/manager", auth, authorize("manager"), (req, res) => {
  res.json({ msg: "Welcome manager" });
});

router.get("/employee", auth, authorize("employee"), (req, res) => {
  res.json({ msg: "Welcome employee" });
});

module.exports = router