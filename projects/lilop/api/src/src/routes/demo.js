const router = require('express').Router();
const { run, status, updateStep } = require('../controllers/demo');

router.post('/run',              run);
router.get('/status/:id',        status);
router.patch('/step/:id',        updateStep);

module.exports = router;
