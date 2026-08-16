const router = require('express').Router();
const { login, vendedores } = require('../controllers/auth');
const { auth } = require('../middleware/auth');
router.post('/login', login);
router.get('/vendedores', auth, vendedores);
module.exports = router;
