// キメ友SNS: Push通知の購読（オン／オフ）
(function () {
  const button = document.getElementById('kimetomo-push-button');
  const status = document.getElementById('kimetomo-push-status');
  if (!button || !status) return;

  const TABLE = 'kimetomo_push_subscriptions';
  let client = null;

  function show(text) { status.textContent = text; }

  function getClient() {
    if (client) return client;
    let cfg = null;
    try { cfg = JSON.parse(localStorage.getItem('kimetomo_supabase') || 'null'); } catch { cfg = null; }
    if (!cfg || !window.supabase) return null;
    client = window.supabase.createClient(cfg.url, cfg.key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    return client;
  }

  function keyToBytes(base64) {
    const padding = '='.repeat((4 - (base64.length % 4)) % 4);
    const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(raw, c => c.charCodeAt(0));
  }

  function supported() {
    return 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  }

  function isIos() {
    return /iPhone|iPad|iPod/.test(navigator.userAgent);
  }

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  }

  async function currentSubscription() {
    const reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function refresh() {
    if (!supported()) {
      button.disabled = true;
      show(isIos() && !isStandalone()
        ? 'iPhoneでは、Safariの共有ボタン →「ホーム画面に追加」から開くと通知を使えます。'
        : 'この環境では通知を使えません。');
      return;
    }
    const sub = await currentSubscription();
    const on = !!sub && Notification.permission === 'granted';
    button.textContent = on ? '🔕 通知をオフにする' : '🔔 通知をオンにする';
    button.dataset.on = on ? '1' : '';
    show(on ? '通知はオンです。' : '通知はオフです。');
  }

  async function turnOn() {
    const sb = getClient();
    if (!sb) { show('先にログインしてください。'); return; }
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { show('先にログインしてください。'); return; }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      show('通知が許可されませんでした。iPhoneの「設定」→「通知」から許可できます。');
      return;
    }

    const reg = await navigator.serviceWorker.ready;
    const sub = (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: keyToBytes(window.KIMETOMO_VAPID_PUBLIC_KEY)
      }));

    const json = sub.toJSON();
    const { error } = await sb.from(TABLE).upsert({
      user_id: user.id,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    }, { onConflict: 'endpoint' });
    if (error) throw error;
  }

  async function turnOff() {
    const sub = await currentSubscription();
    if (!sub) return;
    const sb = getClient();
    if (sb) await sb.from(TABLE).delete().eq('endpoint', sub.endpoint);
    await sub.unsubscribe();
    try { localStorage.removeItem('km-push-sync'); } catch {}
  }

  button.addEventListener('click', async () => {
    button.disabled = true;
    try {
      if (button.dataset.on) await turnOff(); else await turnOn();
    } catch (error) {
      console.error('Push setup failed', error);
      show('通知の設定に失敗しました。時間をおいてもう一度お試しください。');
      button.disabled = false;
      return;
    }
    button.disabled = false;
    await refresh();
  });

  // 使っている端末の手順を先に表示し、通知がオフなら説明を開いておく
  const help = document.getElementById('km-push-help');
  if (help) {
    const ios = document.getElementById('km-push-help-ios');
    const android = document.getElementById('km-push-help-android');
    if (/Android/i.test(navigator.userAgent) && ios && android) help.insertBefore(android, ios);
  }

  // 通知がオンの端末は、開いたときに登録をそっと送り直す（サーバー側で消えていても自動で戻る）
  // 同じ人・同じ端末なら 6 時間に 1 回だけ（通信を増やしすぎないため）
  async function resync() {
    if (!supported() || Notification.permission !== 'granted') return;
    const sub = await currentSubscription();
    if (!sub) return;
    const sb = getClient();
    if (!sb) return;
    const { data: { session } } = await sb.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const json = sub.toJSON();
    const KEY = 'km-push-sync';
    try {
      const last = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (last && last.u === uid && last.e === json.endpoint && Date.now() - last.at < 6 * 3600e3) return;
    } catch {}
    const { error } = await sb.from(TABLE).upsert({
      user_id: uid,
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth
    }, { onConflict: 'endpoint' });
    if (!error) { try { localStorage.setItem(KEY, JSON.stringify({ u: uid, e: json.endpoint, at: Date.now() })); } catch {} }
  }

  refresh()
    .then(() => { if (help && !button.dataset.on) help.open = true; })
    .then(() => resync())
    .catch(error => console.error('Push status failed', error));
})();
