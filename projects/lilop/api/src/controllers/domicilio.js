'use strict';

const enviarDomicilio = async (req, res) => {
  const WEBHOOK_URL = 'https://n8n.autokore.space/webhook/envwdomlilop';
  try {
    const response = await fetch(WEBHOOK_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ pedido_id: req.params.id, ...req.body }),
    });
    if (!response.ok) throw new Error(`Webhook error ${response.status}`);
    res.json({ ok: true });
  } catch (err) {
    console.error('Error webhook domicilio:', err.message);
    res.status(500).json({ error: 'Error al enviar al webhook' });
  }
};

module.exports = { enviarDomicilio };
