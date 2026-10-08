async function checkFlow() {
  for (const url of ['https://whatsapp-flow.1automations.com', 'https://partner-api.1automations.com', 'https://mapi.1automations.com']) {
    try {
      const res = await fetch(url);
      console.log(url, res.status, (await res.text()).slice(0, 300));
    } catch (e) {
      console.log(url, "Error:", e.message);
    }
  }
}
checkFlow();
