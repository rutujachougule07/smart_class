async function checkSite() {
  for (const url of ['https://webhooks.1automations.com', 'https://1automations.com', 'https://api.1automations.com']) {
    try {
      const res = await fetch(url);
      console.log(url, res.status, (await res.text()).slice(0, 200));
    } catch (e) {
      console.log(url, "Error:", e.message);
    }
  }
}
checkSite();
