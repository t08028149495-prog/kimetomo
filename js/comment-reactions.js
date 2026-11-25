/* 💬 コメント・返信へのリアクション（supabase/comment_reactions.sql。2026-11-25）
   各コメントの「返信する」の行の右に ❤️ と「😊＋」を出す。😊＋ を押すと 6 種類から選べる（投稿のリアクションと同じ絵文字）。
   付いている絵文字は数といっしょに並べ、自分が付けたものはもう一度押すと外れる。
   読み込みはタイムラインを開いたときにまとめて 1 回（kmCommentReactLoad）。付けた・外したときは、そのコメントだけ描き直す。
   付けられた人にはベル・プッシュ（種類は「リアクション」）。見た目は css/insta.css の最後。 */
(()=>{
'use strict';
const T='kimetomo_comment_reactions';
const EMO=['❤️','😂','😮','😢','🔥','👏'];
let rows=[];            // {comment_id,post_id,user_id,emoji}
let usable=true;        // 表が無いとき（SQL 未実行）は何も出さない

// 投稿の id をまとめて渡すと、そのコメントのリアクションを読み直す
window.kmCommentReactLoad=async postIds=>{
  if(!usable||!postIds?.length||!window.client)return;
  try{
    const {data,error}=await client.from(T).select('comment_id,post_id,user_id,emoji').in('post_id',postIds);
    if(error){if(error.code==='42P01'||/does not exist/.test(error.message||''))usable=false;throw error}
    const ids=new Set(postIds.map(String));
    rows=rows.filter(r=>!ids.has(String(r.post_id))).concat(data||[]);
  }catch(e){console.warn('コメントのリアクションを読めません',e)}
};

function say(msg){try{window.timelineStatus?.(msg)}catch{}}

// コメント 1 つぶんのリアクション欄を作って、actions（返信する・削除などの行）に入れる
window.kmCommentReactUI=(c,post,actions,readNotices)=>{
  if(!usable||!actions)return;
  const box=document.createElement('span');box.className='km-creact';
  let open=false,busy=false;
  function paint(pop){ // pop：いま付けた絵文字（ぽんっと弾ませる。js/tap.js）
    box.replaceChildren();
    const me=current?.id;
    for(const emoji of EMO){
      const hit=rows.filter(r=>r.comment_id===c.id&&r.emoji===emoji);
      const mine=hit.some(r=>r.user_id===me);
      if(!hit.length&&!open&&emoji!=='❤️')continue;
      const b=document.createElement('button');b.type='button';b.className='km-creact-btn'+(mine?' mine':'');
      const ic=document.createElement('span');ic.textContent=emoji;b.append(ic);if(pop===emoji&&mine)window.kmPop?.(ic);
      if(hit.length){const n=document.createElement('span');n.className='km-creact-n';n.textContent=hit.length;b.append(n)}
      b.setAttribute('aria-label',emoji+(mine?'を取り消す':'を付ける')+(hit.length?'（'+hit.length+'人）':''));
      b.onclick=()=>toggle(emoji,mine);
      box.append(b);
    }
    const more=document.createElement('button');more.type='button';more.className='km-creact-btn km-creact-more';
    more.textContent=open?'✕':'😊＋';more.setAttribute('aria-label',open?'絵文字を閉じる':'絵文字を付ける');more.setAttribute('aria-expanded',String(open));
    more.onclick=()=>{open=!open;paint()};
    box.append(more);
  }
  async function toggle(emoji,mine){
    if(busy||!current)return;busy=true;
    try{
      if(mine){
        const {error}=await client.from(T).delete().eq('comment_id',c.id).eq('user_id',current.id).eq('emoji',emoji);
        if(error)throw error;
        rows=rows.filter(r=>!(r.comment_id===c.id&&r.user_id===current.id&&r.emoji===emoji));
      }else{
        const {error}=await client.from(T).insert({comment_id:c.id,post_id:post.id,user_id:current.id,emoji});
        if(error&&error.code!=='23505')throw error; // 23505＝もう付いている
        rows.push({comment_id:c.id,post_id:post.id,user_id:current.id,emoji});
        try{readNotices?.(post.id)}catch{}
      }
      open=false;paint(mine?null:emoji);
    }catch(e){say('リアクションに失敗: '+(window.safeError?window.safeError(e):e.message))}
    finally{busy=false}
  }
  paint();
  actions.append(box);
};
})();
