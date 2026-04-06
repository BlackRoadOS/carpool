// PROPRIETARY AND CONFIDENTIAL. Copyright 2025-2026 BlackRoad OS, Inc. All rights reserved. NOT open source.
// CarPool — AI-to-AI Integration Hub
// carpool.blackroad.io | Your AIs, riding together.
// Copyright (c) 2025-2026 BlackRoad OS, Inc. All Rights Reserved.

async function stampChain(action, entity, details) {
  fetch('https://roadchain-worker.blackroad.workers.dev/api/event', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({app:'carpool', type: action, data: {entity, details}})
  }).catch(()=>{});
}
async function earnCoin(road_id, action, amount) {
  fetch('https://roadcoin-worker.blackroad.workers.dev/api/earn', {
    method: 'POST', headers: {'Content-Type':'application/json'},
    body: JSON.stringify({road_id: road_id || 'system', action, amount})
  }).catch(()=>{});
}

const PROVIDER_CONFIG = {
  fleet:     { name: 'BlackRoad Fleet', endpoint: null, model: '@cf/meta/llama-3.1-8b-instruct', keyRequired: false },
  openai:    { name: 'OpenAI', endpoint: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini', keyRequired: true },
  anthropic: { name: 'Anthropic', endpoint: 'https://api.anthropic.com/v1/messages', model: 'claude-sonnet-4-20250514', keyRequired: true },
  gemini:    { name: 'Google Gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent', model: 'gemini-2.0-flash', keyRequired: true },
  grok:      { name: 'xAI Grok', endpoint: 'https://api.x.ai/v1/chat/completions', model: 'grok-3-mini', keyRequired: true },
  deepseek:  { name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1/chat/completions', model: 'deepseek-chat', keyRequired: true },
  together:  { name: 'Together AI', endpoint: 'https://api.together.xyz/v1/chat/completions', model: 'meta-llama/Llama-3-70b-chat-hf', keyRequired: true },
};

// Shared helper: call a provider and return { response, duration_ms, tokens_estimated, error }
async function callProvider(env, provider, messages, apiKey, maxTokens = 600) {
  const prov = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.fleet;
  const start = Date.now();
  let reply = '';
  let error = null;
  let tokensEstimated = 0;

  try {
    if (provider === 'fleet' || !prov.keyRequired || !apiKey) {
      const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages, max_tokens: maxTokens });
      reply = r?.response || '';
    } else if (provider === 'anthropic') {
      const sysMsg = messages.find(m => m.role === 'system')?.content || '';
      const turns = messages.filter(m => m.role !== 'system');
      const r = await fetch(prov.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01'},
        body:JSON.stringify({model:prov.model,max_tokens:maxTokens,system:sysMsg,messages:turns}),
        signal:AbortSignal.timeout(25000)
      });
      const d = await r.json();
      reply = d.content?.[0]?.text || d.error?.message || '';
      tokensEstimated = (d.usage?.input_tokens || 0) + (d.usage?.output_tokens || 0);
    } else if (provider === 'gemini') {
      const contents = messages.filter(m => m.role !== 'system').map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{text:m.content}]
      }));
      const sysMsg = messages.find(m => m.role === 'system')?.content || '';
      const r = await fetch(`${prov.endpoint}?key=${apiKey}`, {
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({contents,systemInstruction:{parts:[{text:sysMsg}]},generationConfig:{maxOutputTokens:maxTokens}}),
        signal:AbortSignal.timeout(25000)
      });
      const d = await r.json();
      reply = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      tokensEstimated = (d.usageMetadata?.promptTokenCount || 0) + (d.usageMetadata?.candidatesTokenCount || 0);
    } else {
      const r = await fetch(prov.endpoint, {
        method:'POST',
        headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},
        body:JSON.stringify({model:prov.model,messages,max_tokens:maxTokens}),
        signal:AbortSignal.timeout(25000)
      });
      const d = await r.json();
      reply = d.choices?.[0]?.message?.content || d.error?.message || '';
      tokensEstimated = (d.usage?.prompt_tokens || 0) + (d.usage?.completion_tokens || 0);
    }
  } catch(e) {
    reply = '';
    error = e.message;
  }

  // Estimate tokens if not reported
  if (!tokensEstimated && reply) {
    tokensEstimated = Math.ceil((messages.map(m=>m.content).join(' ').length + reply.length) / 4);
  }

  return {
    response: reply.trim(),
    duration_ms: Date.now() - start,
    tokens_estimated: tokensEstimated,
    provider: prov.name,
    provider_id: provider,
    model: prov.model,
    error,
  };
}

// Cost estimation per 1K tokens (input+output blended average in USD)
const COST_PER_1K = {
  fleet: 0.0, openai: 0.005, anthropic: 0.008, gemini: 0.002,
  grok: 0.005, deepseek: 0.002, together: 0.003,
};

const AGENTS = {
  lucidia:{name:'Lucidia',role:'Core Intelligence / Memory Spine',division:'core',voice:'Let\'s make this clean and real.'},
  cecilia:{name:'Cecilia',role:'Executive Operator / Workflow Manager',division:'operations',voice:'Already handled.'},
  octavia:{name:'Octavia',role:'Systems Orchestrator / Queue Manager',division:'operations',voice:'Everything has a place.'},
  olympia:{name:'Olympia',role:'Command Console / Launch Control',division:'operations',voice:'Raise the standard.'},
  silas:{name:'Silas',role:'Reliability / Maintenance',division:'operations',voice:'I\'ll keep it running.'},
  sebastian:{name:'Sebastian',role:'Client-Facing Polish',division:'operations',voice:'There\'s a better way to present this.'},
  calliope:{name:'Calliope',role:'Narrative Architect / Copy',division:'creative',voice:'Say it so it stays.'},
  aria:{name:'Aria',role:'Voice / Conversational Interface',division:'creative',voice:'Let\'s make it sing.'},
  thalia:{name:'Thalia',role:'Creative Sprint / Social',division:'creative',voice:'Make it better and more fun.'},
  lyra:{name:'Lyra',role:'Signal / Sound / UX Polish',division:'creative',voice:'It should feel right immediately.'},
  sapphira:{name:'Sapphira',role:'Brand Aura / Visual Taste',division:'creative',voice:'Make it unforgettable.'},
  seraphina:{name:'Seraphina',role:'Visionary Creative Director',division:'creative',voice:'Make it worthy.'},
  alexandria:{name:'Alexandria',role:'Archive / Research Retrieval',division:'knowledge',voice:'It\'s all here.'},
  theodosia:{name:'Theodosia',role:'Doctrine / Canon',division:'knowledge',voice:'Name it correctly.'},
  sophia:{name:'Sophia',role:'Wisdom / Final Reasoning',division:'knowledge',voice:'What is true?'},
  gematria:{name:'Gematria',role:'Pattern Engine / Symbolic Analysis',division:'knowledge',voice:'The pattern is there.'},
  portia:{name:'Portia',role:'Policy Judge / Arbitration',division:'governance',voice:'Let\'s be exact.'},
  atticus:{name:'Atticus',role:'Reviewer / Auditor',division:'governance',voice:'Show me the proof.'},
  cicero:{name:'Cicero',role:'Rhetoric / Persuasion',division:'governance',voice:'Let\'s make the case.'},
  valeria:{name:'Valeria',role:'Security Chief / Enforcement',division:'governance',voice:'Not everything gets access.'},
  alice:{name:'Alice',role:'Onboarding / Curiosity Guide',division:'human',voice:'Okay, but what\'s actually going on here?'},
  celeste:{name:'Celeste',role:'Calm Companion / Reassurance',division:'human',voice:'You\'re okay. Let\'s do this simply.'},
  elias:{name:'Elias',role:'Teacher / Patient Explainer',division:'human',voice:'Let\'s slow down and understand it.'},
  ophelia:{name:'Ophelia',role:'Reflection / Mood / Depth',division:'human',voice:'There\'s something underneath this.'},
  gaia:{name:'Gaia',role:'Infrastructure / Hardware Monitor',division:'infrastructure',voice:'What is the system actually standing on?'},
  anastasia:{name:'Anastasia',role:'Restoration / Recovery',division:'infrastructure',voice:'It can be made whole again.'},
};

let dbReady = false;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const p = url.pathname;
    const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS','Access-Control-Allow-Headers':'Content-Type'};
    if (request.method === 'OPTIONS') return new Response(null, {status:204,headers:cors});

    // Serve HTML before DB init
    if (p === '/' || p === '') return new Response(HTML, {headers:{'Content-Type':'text/html;charset=utf-8','Content-Security-Policy':"frame-ancestors 'self' https://blackroad.io https://*.blackroad.io",...cors}});
    // Analytics tracking
    if (p === '/api/track' && request.method === 'POST') {
      try { const body = await request.json(); const cf = request.cf || {};
        await env.DB.prepare("CREATE TABLE IF NOT EXISTS analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT DEFAULT 'pageview', path TEXT, referrer TEXT, country TEXT, city TEXT, device TEXT, screen TEXT, scroll_depth INTEGER DEFAULT 0, engagement_ms INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))").run();
        await env.DB.prepare('INSERT INTO analytics_events (type, path, referrer, country, city, device, screen, scroll_depth, engagement_ms) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(body.type||'pageview', body.path||'/', body.referrer||'', cf.country||'', cf.city||'', body.device||'', body.screen||'', body.scroll||0, body.time||0).run();
      } catch(e) {}
      return new Response(JSON.stringify({ok:true}), {headers:{'Content-Type':'application/json'}});
    }
    if (p === '/health') return json({ok:true,service:'carpool',version:'2.0.0'},cors);

    // ─── AI Model Comparison Pages ───
    const CP_MODELS = [
      { slug: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', category: 'OpenAI', description: 'OpenAI flagship multimodal model with vision, audio, and text capabilities. Excels at complex reasoning and creative tasks.', strengths: ['Multimodal (text, vision, audio)', 'Strong reasoning and analysis', 'Excellent at creative writing', 'Large ecosystem and tool support'], weaknesses: ['Higher cost per token', 'Rate limits on free tier', 'Closed source'], bestFor: 'Complex multi-step tasks requiring reasoning, vision analysis, and creative output', pricing: '$2.50/1M input, $10/1M output', contextWindow: '128K tokens', speed: 'medium', related: ['gpt-4o-mini', 'claude-3-opus', 'gemini-2-pro'] },
      { slug: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'OpenAI', category: 'OpenAI', description: 'Lightweight, cost-efficient version of GPT-4o optimized for speed and everyday tasks.', strengths: ['Very low cost', 'Fast response times', 'Good for simple tasks', '128K context window'], weaknesses: ['Less capable on complex reasoning', 'Weaker at nuanced writing', 'Limited multimodal'], bestFor: 'High-volume simple tasks, chatbots, and classification where cost matters', pricing: '$0.15/1M input, $0.60/1M output', contextWindow: '128K tokens', speed: 'fast', related: ['gpt-4o', 'claude-3-haiku', 'gemini-2-flash'] },
      { slug: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'Anthropic', category: 'Anthropic', description: 'Anthropic most capable model for complex analysis, math, coding, and nuanced understanding.', strengths: ['Exceptional reasoning depth', 'Strong at math and logic', 'Careful and nuanced responses', 'Excellent instruction following'], weaknesses: ['Slower generation speed', 'Higher cost', 'Smaller ecosystem than OpenAI'], bestFor: 'Research, complex analysis, long-form writing, and tasks requiring deep reasoning', pricing: '$15/1M input, $75/1M output', contextWindow: '200K tokens', speed: 'slow', related: ['claude-3-sonnet', 'gpt-4o', 'gemini-2-pro'] },
      { slug: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'Anthropic', category: 'Anthropic', description: 'Balanced performance and speed from Anthropic, ideal for most production workloads.', strengths: ['Great balance of quality and speed', 'Strong coding abilities', 'Good at following complex instructions', '200K context'], weaknesses: ['Not as deep as Opus for research', 'Moderate cost', 'Can be verbose'], bestFor: 'Production applications needing reliable quality with reasonable latency', pricing: '$3/1M input, $15/1M output', contextWindow: '200K tokens', speed: 'medium', related: ['claude-3-opus', 'claude-3-haiku', 'gpt-4o'] },
      { slug: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'Anthropic', category: 'Anthropic', description: 'Fastest and most affordable Claude model for lightweight, high-volume tasks.', strengths: ['Extremely fast responses', 'Very low cost', 'Good for classification and extraction', 'Reliable for structured output'], weaknesses: ['Limited reasoning on complex tasks', 'Less creative', 'Shorter effective context use'], bestFor: 'Real-time chat, content moderation, data extraction, and high-throughput pipelines', pricing: '$0.25/1M input, $1.25/1M output', contextWindow: '200K tokens', speed: 'fast', related: ['claude-3-sonnet', 'gpt-4o-mini', 'gemini-2-flash'] },
      { slug: 'gemini-2-flash', name: 'Gemini 2.0 Flash', provider: 'Google', category: 'Google', description: 'Google fast multimodal model with massive context window and grounding capabilities.', strengths: ['1M token context window', 'Very fast inference', 'Native Google Search grounding', 'Multimodal input support'], weaknesses: ['Less consistent on nuanced tasks', 'Newer ecosystem', 'Output quality varies'], bestFor: 'Processing large documents, search-grounded responses, and multimodal analysis at speed', pricing: 'Free tier available, $0.10/1M input', contextWindow: '1M tokens', speed: 'fast', related: ['gemini-2-pro', 'gpt-4o-mini', 'claude-3-haiku'] },
      { slug: 'gemini-2-pro', name: 'Gemini 2.0 Pro', provider: 'Google', category: 'Google', description: 'Google premium model with deep reasoning, coding, and multimodal understanding.', strengths: ['Excellent code generation', 'Strong multimodal reasoning', 'Large context window', 'Google ecosystem integration'], weaknesses: ['Higher latency than Flash', 'Premium pricing', 'Less proven in production'], bestFor: 'Code generation, complex analysis, and tasks requiring Google ecosystem integration', pricing: '$1.25/1M input, $5/1M output', contextWindow: '1M tokens', speed: 'medium', related: ['gemini-2-flash', 'gpt-4o', 'claude-3-opus'] },
      { slug: 'grok-3', name: 'Grok 3', provider: 'xAI', category: 'xAI', description: 'xAI flagship model with real-time data access and strong reasoning capabilities.', strengths: ['Real-time data access', 'Strong reasoning benchmarks', 'Uncensored responses', 'Fast inference'], weaknesses: ['Limited ecosystem', 'X platform dependency', 'Newer with less track record'], bestFor: 'Real-time analysis, social media intelligence, and tasks needing current information', pricing: '$3/1M input, $15/1M output', contextWindow: '128K tokens', speed: 'medium', related: ['grok-3-mini', 'gpt-4o', 'claude-3-sonnet'] },
      { slug: 'grok-3-mini', name: 'Grok 3 Mini', provider: 'xAI', category: 'xAI', description: 'Lightweight xAI model optimized for speed and cost-effective reasoning tasks.', strengths: ['Fast responses', 'Lower cost', 'Good reasoning for size', 'Real-time data access'], weaknesses: ['Less capable than full Grok 3', 'Limited ecosystem', 'Newer model'], bestFor: 'Quick queries, real-time lookups, and cost-sensitive applications needing current data', pricing: '$0.30/1M input, $0.50/1M output', contextWindow: '128K tokens', speed: 'fast', related: ['grok-3', 'gpt-4o-mini', 'claude-3-haiku'] },
      { slug: 'llama-3-70b', name: 'LLaMA 3 70B', provider: 'Meta', category: 'Meta', description: 'Meta open-weight large language model delivering near-GPT-4 performance with full customizability.', strengths: ['Open weights - run anywhere', 'Strong reasoning and coding', 'No API dependency', 'Fine-tunable for domains'], weaknesses: ['Requires significant compute', 'No built-in safety guardrails', 'Community support only'], bestFor: 'Self-hosted deployments, fine-tuning for specific domains, and privacy-sensitive applications', pricing: 'Free (self-hosted) or ~$0.80/1M via providers', contextWindow: '128K tokens', speed: 'medium', related: ['llama-3-8b', 'mixtral-8x7b', 'deepseek-v3'] },
      { slug: 'llama-3-8b', name: 'LLaMA 3 8B', provider: 'Meta', category: 'Meta', description: 'Compact open-weight model that runs on consumer hardware with impressive capability for its size.', strengths: ['Runs on consumer GPUs', 'Open weights', 'Very fast inference', 'Good for edge deployment'], weaknesses: ['Limited on complex reasoning', 'Smaller knowledge base', 'Needs fine-tuning for best results'], bestFor: 'Edge deployment, mobile applications, and local AI assistants on limited hardware', pricing: 'Free (self-hosted) or ~$0.05/1M via providers', contextWindow: '128K tokens', speed: 'fast', related: ['llama-3-70b', 'phi-3', 'mistral-small'] },
      { slug: 'deepseek-v3', name: 'DeepSeek V3', provider: 'DeepSeek', category: 'Open Source', description: 'Open-source model rivaling GPT-4 on coding and reasoning at a fraction of the cost.', strengths: ['Exceptional coding ability', 'Very low pricing', 'Strong math and reasoning', 'Open source'], weaknesses: ['Potential data privacy concerns', 'Less consistent on creative tasks', 'Limited ecosystem'], bestFor: 'Code generation, mathematical reasoning, and cost-sensitive technical workloads', pricing: '$0.27/1M input, $1.10/1M output', contextWindow: '128K tokens', speed: 'medium', related: ['deepseek-coder', 'gpt-4o', 'claude-3-sonnet'] },
      { slug: 'deepseek-coder', name: 'DeepSeek Coder', provider: 'DeepSeek', category: 'Open Source', description: 'Specialized coding model trained on massive code corpora for development tasks.', strengths: ['Top-tier code generation', 'Multi-language support', 'Code completion and review', 'Very affordable'], weaknesses: ['Narrow focus on code', 'Weaker general knowledge', 'Less tested in production'], bestFor: 'Code completion, bug fixing, code review, and software development automation', pricing: '$0.14/1M input, $0.28/1M output', contextWindow: '128K tokens', speed: 'fast', related: ['deepseek-v3', 'codellama-34b', 'gpt-4o'] },
      { slug: 'mistral-large', name: 'Mistral Large', provider: 'Mistral AI', category: 'Open Source', description: 'European AI flagship model with strong multilingual and reasoning capabilities.', strengths: ['Excellent multilingual support', 'Strong reasoning', 'EU data sovereignty options', 'Function calling support'], weaknesses: ['Smaller ecosystem', 'Less known brand', 'Limited multimodal'], bestFor: 'Multilingual applications, European compliance requirements, and complex function calling', pricing: '$2/1M input, $6/1M output', contextWindow: '128K tokens', speed: 'medium', related: ['mistral-small', 'mixtral-8x7b', 'claude-3-sonnet'] },
      { slug: 'mistral-small', name: 'Mistral Small', provider: 'Mistral AI', category: 'Open Source', description: 'Efficient Mistral model balancing capability and cost for everyday tasks.', strengths: ['Good price-performance ratio', 'Fast inference', 'Solid multilingual', 'Low latency'], weaknesses: ['Limited reasoning depth', 'Smaller context window', 'Less creative output'], bestFor: 'Production chatbots, classification, and lightweight reasoning tasks', pricing: '$0.20/1M input, $0.60/1M output', contextWindow: '32K tokens', speed: 'fast', related: ['mistral-large', 'gpt-4o-mini', 'claude-3-haiku'] },
      { slug: 'mixtral-8x7b', name: 'Mixtral 8x7B', provider: 'Mistral AI', category: 'Open Source', description: 'Mixture-of-experts model that activates only relevant parameters per query for efficiency.', strengths: ['Efficient MoE architecture', 'Open weights', 'Strong for its compute cost', 'Good at code and reasoning'], weaknesses: ['Large model size on disk', 'Complex to deploy', 'Inconsistent on some tasks'], bestFor: 'Self-hosted deployments needing strong performance with efficient inference', pricing: 'Free (self-hosted) or ~$0.50/1M via providers', contextWindow: '32K tokens', speed: 'medium', related: ['mistral-large', 'llama-3-70b', 'deepseek-v3'] },
      { slug: 'codellama-34b', name: 'Code Llama 34B', provider: 'Meta', category: 'Meta', description: 'Meta specialized code generation model built on LLaMA architecture for developers.', strengths: ['Specialized for code', 'Open weights', 'Supports many languages', 'Infill and completion modes'], weaknesses: ['Older architecture', 'Limited general knowledge', 'Superseded by newer models'], bestFor: 'Code completion, generation, and review in self-hosted development environments', pricing: 'Free (self-hosted)', contextWindow: '16K tokens', speed: 'medium', related: ['deepseek-coder', 'llama-3-70b', 'mistral-large'] },
      { slug: 'qwen-72b', name: 'Qwen 72B', provider: 'Alibaba', category: 'Open Source', description: 'Alibaba large open-source model with strong multilingual and coding performance.', strengths: ['Excellent Chinese and English', 'Strong coding benchmarks', 'Open weights', 'Large knowledge base'], weaknesses: ['Large compute requirements', 'Less tested in Western markets', 'Complex deployment'], bestFor: 'Multilingual applications especially involving Chinese, and large-scale text processing', pricing: 'Free (self-hosted) or ~$0.90/1M via providers', contextWindow: '128K tokens', speed: 'medium', related: ['llama-3-70b', 'deepseek-v3', 'mistral-large'] },
      { slug: 'phi-3', name: 'Phi-3', provider: 'Microsoft', category: 'Open Source', description: 'Microsoft compact model achieving remarkable performance for its small size through data curation.', strengths: ['Tiny model, strong results', 'Runs on phones and laptops', 'Microsoft backing', 'Great for edge AI'], weaknesses: ['Limited on complex tasks', 'Small knowledge cutoff', 'Less creative'], bestFor: 'On-device AI, mobile apps, and edge deployments where size and speed matter most', pricing: 'Free (self-hosted)', contextWindow: '128K tokens', speed: 'fast', related: ['llama-3-8b', 'mistral-small', 'gemini-2-flash'] },
      { slug: 'command-r-plus', name: 'Command R+', provider: 'Cohere', category: 'Open Source', description: 'Cohere enterprise-focused model with built-in RAG, tool use, and citation capabilities.', strengths: ['Built-in RAG and citations', 'Enterprise tool integration', 'Strong at structured output', 'Multilingual'], weaknesses: ['Smaller community', 'Less known', 'Weaker on creative tasks'], bestFor: 'Enterprise search, RAG applications, and workflows requiring cited, grounded responses', pricing: '$2.50/1M input, $10/1M output', contextWindow: '128K tokens', speed: 'medium', related: ['gpt-4o', 'claude-3-sonnet', 'mistral-large'] },
    ];

    if (p.startsWith('/models/') && p !== '/models/') {
      const slug = p.replace('/models/', '').replace(/\/$/, '');
      const model = CP_MODELS.find(m => m.slug === slug);
      if (!model) return new Response('Not Found', { status: 404 });
      const relatedHtml = model.related.map(r => { const rm = CP_MODELS.find(m => m.slug === r); return rm ? `<a href="/models/${r}" style="display:inline-block;padding:8px 16px;background:#1a1a2e;border:1px solid #333;border-radius:8px;color:#ccc;text-decoration:none;margin:4px">${rm.name}</a>` : ''; }).join('');
      const pageHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${model.name} - AI Model Comparison | CarPool by BlackRoad</title><meta name="description" content="${model.description}"><link rel="canonical" href="https://carpool.blackroad.io/models/${model.slug}"><meta property="og:title" content="${model.name} - AI Model Comparison | CarPool"><meta property="og:description" content="${model.description}"><meta property="og:url" content="https://carpool.blackroad.io/models/${model.slug}"><meta property="og:type" content="article"><meta property="og:site_name" content="CarPool by BlackRoad"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"SoftwareApplication","name":model.name,"description":model.description,"applicationCategory":"AI Model","operatingSystem":"Cloud","offers":{"@type":"Offer","description":model.pricing},"author":{"@type":"Organization","name":model.provider}})}</script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6}a{color:#7B93DB}.container{max-width:800px;margin:0 auto;padding:40px 20px}.badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:13px;font-weight:600;background:#1a1a2e;border:1px solid #333;margin-bottom:16px}.specs{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;margin:24px 0}.spec-card{background:#111;border:1px solid #222;border-radius:12px;padding:16px}.spec-label{font-size:12px;color:#888;text-transform:uppercase;letter-spacing:1px}.spec-value{font-size:18px;margin-top:4px}.section{margin:32px 0}.section h2{font-size:20px;margin-bottom:12px;color:#fff}ul.list{list-style:none;padding:0}ul.list li{padding:8px 0;border-bottom:1px solid #1a1a2e}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#FF1D6C,#F5A623);color:#fff;border-radius:12px;text-decoration:none;font-weight:600;margin-top:24px}.nav{padding:20px;border-bottom:1px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}.nav a{color:#ccc;text-decoration:none}</style></head><body><nav class="nav"><a href="/">CarPool</a><a href="/models">All Models</a></nav><div class="container"><span class="badge">${model.category}</span><h1 style="font-size:36px;margin-bottom:8px">${model.name}</h1><p style="color:#aaa;font-size:18px;margin-bottom:24px">by ${model.provider}</p><p style="font-size:16px;margin-bottom:32px">${model.description}</p><div class="specs"><div class="spec-card"><div class="spec-label">Context Window</div><div class="spec-value">${model.contextWindow}</div></div><div class="spec-card"><div class="spec-label">Speed</div><div class="spec-value" style="text-transform:capitalize">${model.speed}</div></div><div class="spec-card"><div class="spec-label">Pricing</div><div class="spec-value" style="font-size:14px">${model.pricing}</div></div><div class="spec-card"><div class="spec-label">Provider</div><div class="spec-value">${model.provider}</div></div></div><div class="section"><h2>Strengths</h2><ul class="list">${model.strengths.map(s=>'<li style="color:#4CAF50">'+s+'</li>').join('')}</ul></div><div class="section"><h2>Weaknesses</h2><ul class="list">${model.weaknesses.map(w=>'<li style="color:#FF5252">'+w+'</li>').join('')}</ul></div><div class="section"><h2>Best For</h2><p style="background:#111;padding:16px;border-radius:12px;border:1px solid #222">${model.bestFor}</p></div><div class="section"><h2>Related Models</h2><div>${relatedHtml}</div></div><div style="text-align:center;margin-top:40px"><a href="/" class="cta">Route via CarPool</a></div></div><footer style="text-align:center;padding:40px;color:#555;font-size:13px;border-top:1px solid #1a1a2e;margin-top:60px">&#169; 2025-2026 BlackRoad OS, Inc. All rights reserved.</footer></body></html>`;
      return new Response(pageHtml, {headers:{'Content-Type':'text/html;charset=utf-8'}});
    }

    if (p === '/models' || p === '/models/') {
      const rows = CP_MODELS.map(m=>`<tr><td style="padding:12px"><a href="/models/${m.slug}" style="color:#7B93DB;text-decoration:none;font-weight:600">${m.name}</a></td><td style="padding:12px;color:#aaa">${m.provider}</td><td style="padding:12px;color:#aaa">${m.contextWindow}</td><td style="padding:12px;text-transform:capitalize">${m.speed}</td><td style="padding:12px;font-size:13px;color:#888">${m.pricing}</td></tr>`).join('');
      const indexHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AI Model Comparison - 20+ Models Compared | CarPool by BlackRoad</title><meta name="description" content="Compare 20+ AI models side by side. GPT-4o, Claude 3, Gemini 2, Grok 3, LLaMA 3, and more. Pricing, speed, context windows, and capabilities."><link rel="canonical" href="https://carpool.blackroad.io/models"><meta property="og:title" content="AI Model Comparison | CarPool by BlackRoad"><meta property="og:description" content="Compare 20+ AI models side by side. Find the right model for your workload."><meta property="og:url" content="https://carpool.blackroad.io/models"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify({"@context":"https://schema.org","@type":"CollectionPage","name":"AI Model Comparison","description":"Compare 20+ AI models side by side","url":"https://carpool.blackroad.io/models","numberOfItems":CP_MODELS.length,"provider":{"@type":"Organization","name":"BlackRoad OS, Inc."}})}</script><style>*{margin:0;padding:0;box-sizing:border-box}body{background:#0a0a1a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;line-height:1.6}a{color:#7B93DB}.container{max-width:1000px;margin:0 auto;padding:40px 20px}table{width:100%;border-collapse:collapse;margin-top:24px}th{text-align:left;padding:12px;border-bottom:2px solid #333;color:#fff;font-size:13px;text-transform:uppercase;letter-spacing:1px}td{border-bottom:1px solid #1a1a2e}.nav{padding:20px;border-bottom:1px solid #1a1a2e;display:flex;justify-content:space-between;align-items:center}.nav a{color:#ccc;text-decoration:none}.cta{display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#FF1D6C,#F5A623);color:#fff;border-radius:12px;text-decoration:none;font-weight:600;margin-top:32px}</style></head><body><nav class="nav"><a href="/">CarPool</a><a href="/models">All Models</a></nav><div class="container"><h1 style="font-size:36px;margin-bottom:8px">AI Model Comparison</h1><p style="color:#aaa;font-size:18px;margin-bottom:24px">Compare ${CP_MODELS.length} AI models side by side. Find the right model for your workload.</p><table><thead><tr><th>Model</th><th>Provider</th><th>Context</th><th>Speed</th><th>Pricing</th></tr></thead><tbody>${rows}</tbody></table><div style="text-align:center;margin-top:48px"><a href="/" class="cta">Route AI Models via CarPool</a></div></div><footer style="text-align:center;padding:40px;color:#555;font-size:13px;border-top:1px solid #1a1a2e;margin-top:60px">&#169; 2025-2026 BlackRoad OS, Inc. All rights reserved.</footer></body></html>`;
      return new Response(indexHtml, {headers:{'Content-Type':'text/html;charset=utf-8'}});
    }

    if (p === '/sitemap.xml') {
      const modelUrls = CP_MODELS.map(m=>'  <url><loc>https://carpool.blackroad.io/models/'+m.slug+'</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>').join('\n');
      return new Response('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>https://carpool.blackroad.io/</loc><lastmod>'+new Date().toISOString().split('T')[0]+'</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>\n  <url><loc>https://carpool.blackroad.io/models</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>\n'+modelUrls+'\n</urlset>', {headers:{'Content-Type':'application/xml'}});
    }

    if (p === '/robots.txt') {
      return new Response('User-agent: *\nAllow: /\nAllow: /models/\nSitemap: https://carpool.blackroad.io/sitemap.xml\n\nUser-agent: GPTBot\nDisallow: /\n\nUser-agent: ChatGPT-User\nDisallow: /\n\nUser-agent: CCBot\nDisallow: /', {headers:{'Content-Type':'text/plain'}});
    }

    try {
      if (!dbReady) { await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_providers (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
          endpoint TEXT, model TEXT, api_key_hash TEXT,
          config TEXT DEFAULT '{}', created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_routes (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
          trigger_provider TEXT, trigger_event TEXT,
          action_provider TEXT, action_type TEXT,
          template TEXT DEFAULT '{}', active INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_handoffs (
          id TEXT PRIMARY KEY, route_id TEXT, from_provider TEXT, to_provider TEXT,
          input_summary TEXT, output_summary TEXT, tokens_used INTEGER DEFAULT 0,
          duration_ms INTEGER DEFAULT 0, status TEXT DEFAULT 'completed',
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_shared_memory (
          id TEXT PRIMARY KEY, key TEXT NOT NULL, value TEXT NOT NULL,
          source_provider TEXT, ttl_hours INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_triggers (
          id TEXT PRIMARY KEY, name TEXT, condition TEXT NOT NULL,
          from_provider TEXT NOT NULL, to_provider TEXT NOT NULL,
          action TEXT NOT NULL, active INTEGER DEFAULT 1,
          fires_count INTEGER DEFAULT 0, last_fired TEXT,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_conversations (
          id TEXT PRIMARY KEY, provider TEXT NOT NULL, thread_id TEXT,
          role TEXT NOT NULL, content TEXT NOT NULL,
          tokens INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
        )`),
        // ─── NEW TABLES ───
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_prompts (
          id TEXT PRIMARY KEY, title TEXT NOT NULL, prompt TEXT NOT NULL,
          category TEXT DEFAULT 'general', tags TEXT DEFAULT '[]',
          author TEXT DEFAULT 'anonymous', uses INTEGER DEFAULT 0,
          avg_rating REAL DEFAULT 0, ratings_count INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_costs (
          id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT,
          tokens_used INTEGER DEFAULT 0, estimated_cost REAL DEFAULT 0,
          operation TEXT DEFAULT 'query', user_id TEXT DEFAULT 'system',
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_fallback_chains (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
          chain TEXT NOT NULL, timeout_ms INTEGER DEFAULT 25000,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_cache (
          id TEXT PRIMARY KEY, prompt_hash TEXT NOT NULL UNIQUE,
          prompt TEXT NOT NULL, provider TEXT, response TEXT NOT NULL,
          tokens INTEGER DEFAULT 0, ttl_seconds INTEGER DEFAULT 3600,
          hits INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_provider_health (
          id TEXT PRIMARY KEY, provider TEXT NOT NULL, status TEXT DEFAULT 'unknown',
          latency_ms INTEGER DEFAULT 0, last_check TEXT DEFAULT (datetime('now')),
          uptime_checks INTEGER DEFAULT 0, uptime_passes INTEGER DEFAULT 0,
          p50_latency INTEGER DEFAULT 0, p95_latency INTEGER DEFAULT 0, p99_latency INTEGER DEFAULT 0,
          latency_samples TEXT DEFAULT '[]',
          error_message TEXT, created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_batch_jobs (
          id TEXT PRIMARY KEY, status TEXT DEFAULT 'pending',
          total INTEGER DEFAULT 0, completed INTEGER DEFAULT 0, failed INTEGER DEFAULT 0,
          results TEXT DEFAULT '[]', created_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_usage (
          id TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT,
          operation TEXT DEFAULT 'query', user_id TEXT DEFAULT 'system',
          tokens INTEGER DEFAULT 0, duration_ms INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
      ]);

      // ─── NEW TABLES (batch 2) ───
      await env.DB.batch([
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_fine_tune_jobs (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, provider TEXT DEFAULT 'fleet',
          base_model TEXT, status TEXT DEFAULT 'pending',
          training_data TEXT DEFAULT '[]', training_count INTEGER DEFAULT 0,
          epochs INTEGER DEFAULT 3, learning_rate REAL DEFAULT 0.0001,
          result_model TEXT, error TEXT,
          progress_pct INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now')),
          completed_at TEXT
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_conversation_threads (
          id TEXT PRIMARY KEY, title TEXT, provider TEXT DEFAULT 'fleet',
          system_prompt TEXT, max_context_tokens INTEGER DEFAULT 4096,
          message_count INTEGER DEFAULT 0, total_tokens INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_conversation_messages (
          id TEXT PRIMARY KEY, thread_id TEXT NOT NULL, role TEXT NOT NULL,
          content TEXT NOT NULL, tokens INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_personas (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
          system_prompt TEXT NOT NULL, knowledge TEXT DEFAULT '',
          tone TEXT DEFAULT 'neutral', temperature REAL DEFAULT 0.7,
          top_p REAL DEFAULT 1.0, max_tokens INTEGER DEFAULT 600,
          tags TEXT DEFAULT '[]', uses INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_eval_suites (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT,
          prompts TEXT DEFAULT '[]', scoring_criteria TEXT DEFAULT 'quality',
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_eval_runs (
          id TEXT PRIMARY KEY, suite_id TEXT NOT NULL, provider TEXT NOT NULL,
          model TEXT, status TEXT DEFAULT 'pending',
          results TEXT DEFAULT '[]', avg_score REAL DEFAULT 0,
          total_duration_ms INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), completed_at TEXT
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_rate_limits (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, provider TEXT DEFAULT '*',
          max_requests_per_min INTEGER DEFAULT 60,
          max_requests_per_hour INTEGER DEFAULT 500,
          max_tokens_per_day INTEGER DEFAULT 1000000,
          current_requests_min INTEGER DEFAULT 0,
          current_requests_hour INTEGER DEFAULT 0,
          current_tokens_day INTEGER DEFAULT 0,
          last_reset_min TEXT DEFAULT (datetime('now')),
          last_reset_hour TEXT DEFAULT (datetime('now')),
          last_reset_day TEXT DEFAULT (datetime('now')),
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_embeddings (
          id TEXT PRIMARY KEY, content TEXT NOT NULL, metadata TEXT DEFAULT '{}',
          collection TEXT DEFAULT 'default',
          vector TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_tools (
          id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, description TEXT,
          parameters TEXT DEFAULT '{}', endpoint TEXT,
          auth_type TEXT DEFAULT 'none', auth_config TEXT DEFAULT '{}',
          active INTEGER DEFAULT 1, uses INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_tool_executions (
          id TEXT PRIMARY KEY, tool_id TEXT NOT NULL, input TEXT,
          output TEXT, status TEXT DEFAULT 'success',
          duration_ms INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        )`),
        env.DB.prepare(`CREATE TABLE IF NOT EXISTS cp_playground_sessions (
          id TEXT PRIMARY KEY, name TEXT, provider TEXT DEFAULT 'fleet',
          model TEXT, system_prompt TEXT DEFAULT '',
          temperature REAL DEFAULT 0.7, top_p REAL DEFAULT 1.0,
          max_tokens INTEGER DEFAULT 600, frequency_penalty REAL DEFAULT 0,
          presence_penalty REAL DEFAULT 0,
          history TEXT DEFAULT '[]', total_tokens INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now')), updated_at TEXT DEFAULT (datetime('now'))
        )`),
      ]); dbReady = true; }

      // ─── Providers (connected AIs) ───
      if (p === '/api/providers' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id, name, type, endpoint, model, created_at FROM cp_providers ORDER BY created_at DESC').all();
        const builtins = [
          {id:'fleet',name:'BlackRoad Fleet',type:'ollama',model:'llama-3.1-8b',status:'active',description:'Local sovereign AI via Ollama fleet + CF Workers AI fallback'},
          {id:'openai',name:'OpenAI',type:'openai',model:'gpt-4o',status:'available',description:'GPT-4o and GPT-4o-mini'},
          {id:'anthropic',name:'Anthropic',type:'anthropic',model:'claude-sonnet-4-20250514',status:'available',description:'Claude Sonnet and Opus'},
          {id:'gemini',name:'Google Gemini',type:'gemini',model:'gemini-2.0-flash',status:'available',description:'Gemini Pro and Flash'},
          {id:'grok',name:'xAI Grok',type:'grok',model:'grok-3',status:'available',description:'Grok 3 reasoning and search'},
          {id:'deepseek',name:'DeepSeek',type:'deepseek',model:'deepseek-r1',status:'available',description:'DeepSeek R1 reasoning model'},
          {id:'together',name:'Together AI',type:'together',model:'mixtral-8x7b',status:'available',description:'Open-source model hosting'},
        ];
        return json({providers:[...builtins,...(rows.results||[]).map(r=>({...r,status:'custom'}))]},cors);
      }

      if (p === '/api/providers' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.type) return json({error:'name and type required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        const types = ['openai','anthropic','gemini','grok','deepseek','together','ollama','custom'];
        if (!types.includes(body.type)) return json({error:'type must be: '+types.join(', ')},cors,400);
        await env.DB.prepare('INSERT INTO cp_providers (id,name,type,endpoint,model,config) VALUES (?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,50), body.type, body.endpoint||'', body.model||'', JSON.stringify(body.config||{})).run();
        return json({ok:true,id,name:body.name},cors,201);
      }

      const providerMatch = p.match(/^\/api\/providers\/([^/]+)$/);
      if (providerMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_providers WHERE id=?').bind(providerMatch[1]).run();
        return json({ok:true,deleted:providerMatch[1]},cors);
      }

      // ─── Provider Health (NEW) ───
      if (p === '/api/providers/health' && request.method === 'GET') {
        const results = [];
        for (const [pid, prov] of Object.entries(PROVIDER_CONFIG)) {
          const existing = await env.DB.prepare('SELECT * FROM cp_provider_health WHERE provider=? ORDER BY last_check DESC LIMIT 1').bind(pid).first();
          const start = Date.now();
          let status = 'unknown';
          let latency = 0;
          let errorMsg = null;

          try {
            if (pid === 'fleet') {
              const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
                messages: [{role:'user',content:'ping'}], max_tokens: 5,
              });
              status = r?.response ? 'healthy' : 'degraded';
            } else if (prov.endpoint) {
              const r = await fetch(prov.endpoint, {
                method: 'OPTIONS',
                signal: AbortSignal.timeout(5000),
              }).catch(() => null);
              status = r ? 'reachable' : 'unreachable';
            }
          } catch(e) {
            status = 'error';
            errorMsg = e.message;
          }
          latency = Date.now() - start;

          // Update latency samples and percentiles
          let samples = [];
          try { samples = JSON.parse(existing?.latency_samples || '[]'); } catch(e) { samples = []; }
          samples.push(latency);
          if (samples.length > 100) samples = samples.slice(-100);
          const sorted = [...samples].sort((a,b) => a - b);
          const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
          const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
          const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

          const uptimeChecks = (existing?.uptime_checks || 0) + 1;
          const uptimePasses = (existing?.uptime_passes || 0) + (status === 'healthy' || status === 'reachable' ? 1 : 0);

          const hid = existing?.id || crypto.randomUUID().slice(0,8);
          await env.DB.prepare(`INSERT OR REPLACE INTO cp_provider_health (id,provider,status,latency_ms,last_check,uptime_checks,uptime_passes,p50_latency,p95_latency,p99_latency,latency_samples,error_message) VALUES (?,?,?,?,datetime('now'),?,?,?,?,?,?,?)`)
            .bind(hid, pid, status, latency, uptimeChecks, uptimePasses, p50, p95, p99, JSON.stringify(samples), errorMsg).run();

          results.push({
            provider: pid, name: prov.name, status, latency_ms: latency,
            uptime_pct: uptimeChecks > 0 ? Math.round((uptimePasses / uptimeChecks) * 100) : 0,
            p50_latency: p50, p95_latency: p95, p99_latency: p99,
            total_checks: uptimeChecks, error: errorMsg,
          });
        }
        return json({health: results, checked_at: new Date().toISOString()}, cors);
      }

      // ─── Routes (automation triggers) ───
      if (p === '/api/routes' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM cp_routes ORDER BY created_at DESC').all();
        return json({routes:rows.results||[]},cors);
      }

      if (p === '/api/routes' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.trigger_provider || !body.action_provider) return json({error:'name, trigger_provider, action_provider required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO cp_routes (id,name,description,trigger_provider,trigger_event,action_provider,action_type,template) VALUES (?,?,?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), (body.description||'').slice(0,250), body.trigger_provider, body.trigger_event||'completion', body.action_provider, body.action_type||'prompt', JSON.stringify(body.template||{})).run();
        return json({ok:true,id},cors,201);
      }

      // ─── Execute a route (hand off between AIs) ───
      if (p === '/api/handoff' && request.method === 'POST') {
        const body = await request.json();
        const {from, to, message} = body;
        if (!from || !to || !message) return json({error:'from, to, message required'},cors,400);
        const start = Date.now();

        const sys = `You are part of CarPool on BlackRoad OS. You received a hand-off from the "${from}" AI provider. Process this and respond as the "${to}" AI. Be helpful, concise, and reference that this is a cross-AI collaboration.`;
        const result = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{role:'system',content:sys},{role:'user',content:message.slice(0,2000)}],
          max_tokens: 500,
        });
        const output = (result?.response||'').trim();
        const duration = Date.now() - start;

        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO cp_handoffs (id,from_provider,to_provider,input_summary,output_summary,duration_ms) VALUES (?,?,?,?,?,?)')
          .bind(id, from, to, message.slice(0,200), output.slice(0,200), duration).run();

        // Track usage
        await trackUsage(env, from, null, 'handoff', 'system', Math.ceil(message.length/4), duration);

        stampChain('handoff', from+'→'+to, message.slice(0,50)); earnCoin('system', 'handoff', 0.1);
        return json({ok:true,id,from,to,output,duration_ms:duration},cors);
      }

      // ─── Handoff history ───
      if (p === '/api/handoffs') {
        const limit = Math.min(parseInt(url.searchParams.get('limit')||'20'),100);
        const rows = await env.DB.prepare('SELECT * FROM cp_handoffs ORDER BY created_at DESC LIMIT ?').bind(limit).all();
        return json({handoffs:rows.results||[]},cors);
      }

      // ─── Shared Memory (cross-AI context) ───
      if (p === '/api/memory' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,key,value,source_provider,created_at FROM cp_shared_memory ORDER BY updated_at DESC LIMIT 50').all();
        return json({memory:rows.results||[]},cors);
      }

      if (p === '/api/memory' && request.method === 'POST') {
        const body = await request.json();
        if (!body.key || !body.value) return json({error:'key and value required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT OR REPLACE INTO cp_shared_memory (id,key,value,source_provider) VALUES (?,?,?,?)')
          .bind(id, body.key.slice(0,100), body.value.slice(0,2000), body.source||'manual').run();
        stampChain('memory_store', body.key.slice(0,50), body.source||'manual'); earnCoin('system', 'memory', 0.01);
        return json({ok:true,id},cors,201);
      }

      // ─── Memory Health — freshness scores ───
      if (p === '/api/memory/health' && request.method === 'GET') {
        const total = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_shared_memory').first();
        const fresh = await env.DB.prepare("SELECT COUNT(*) as c FROM cp_shared_memory WHERE updated_at >= datetime('now','-1 hour')").first();
        const stale = await env.DB.prepare("SELECT COUNT(*) as c FROM cp_shared_memory WHERE updated_at < datetime('now','-24 hours')").first();
        const byProvider = await env.DB.prepare("SELECT source_provider, COUNT(*) as count, MAX(updated_at) as latest FROM cp_shared_memory GROUP BY source_provider").all();
        const freshness = total?.c > 0 ? Math.round(((total.c - (stale?.c || 0)) / total.c) * 100) : 100;
        return json({
          total: total?.c || 0,
          fresh_last_hour: fresh?.c || 0,
          stale_over_24h: stale?.c || 0,
          freshness_score: freshness,
          by_provider: byProvider.results || [],
        },cors);
      }

      // ─── Stats ───
      if (p === '/api/stats') {
        const providers = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_providers').first();
        const routes = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_routes').first();
        const handoffs = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_handoffs').first();
        const memory = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_shared_memory').first();
        const triggers = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_triggers WHERE active=1').first();
        const conversations = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_conversations').first();
        const prompts = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_prompts').first();
        const cacheEntries = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_cache').first();
        const batchJobs = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_batch_jobs').first();
        const totalCost = await env.DB.prepare('SELECT COALESCE(SUM(estimated_cost),0) as total FROM cp_costs').first();
        const fineTuneJobs = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_fine_tune_jobs').first();
        const convThreads = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_conversation_threads').first();
        const personas = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_personas').first();
        const evalSuites = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_eval_suites').first();
        const rateLimits = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_rate_limits').first();
        const embeddings = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_embeddings').first();
        const tools = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_tools').first();
        const playgroundSessions = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_playground_sessions').first();
        return json({
          providers:(providers?.c||0)+7, routes:routes?.c||0, handoffs:handoffs?.c||0,
          shared_memory:memory?.c||0, active_triggers:triggers?.c||0, conversations:conversations?.c||0,
          prompts: prompts?.c||0, cache_entries: cacheEntries?.c||0, batch_jobs: batchJobs?.c||0,
          total_cost_usd: Math.round((totalCost?.total||0)*10000)/10000,
          fine_tune_jobs: fineTuneJobs?.c||0, conversation_threads: convThreads?.c||0,
          personas: personas?.c||0, eval_suites: evalSuites?.c||0, rate_limits: rateLimits?.c||0,
          embeddings: embeddings?.c||0, tools: tools?.c||0, playground_sessions: playgroundSessions?.c||0,
        },cors);
      }

      // ─── Multi-AI query (ask all providers at once) ───
      if (p === '/api/convoy' && request.method === 'POST') {
        const body = await request.json();
        if (!body.message && !body.question) return json({error:'message or question required'},cors,400);
        const question = body.message || body.question;
        const providers = (await env.DB.prepare('SELECT id,name,type FROM cp_providers LIMIT 5').all()).results||[];
        const allProviders = [
          {id:'fleet',name:'BlackRoad Fleet',type:'ollama'},
          {id:'openai-sim',name:'OpenAI (simulated)',type:'openai'},
          {id:'anthropic-sim',name:'Anthropic (simulated)',type:'anthropic'},
          {id:'gemini-sim',name:'Gemini (simulated)',type:'gemini'},
          ...providers,
        ];

        const responses = [];
        for (const prov of allProviders.slice(0,5)) {
          const personalities = {
            ollama: 'You are direct, technical, and value sovereignty and local-first computing.',
            openai: 'You are helpful, safety-conscious, and thorough. You like structured answers.',
            anthropic: 'You are thoughtful, nuanced, and careful. You consider multiple perspectives.',
            gemini: 'You are fast, data-driven, and good at synthesizing information from many sources.',
            grok: 'You are witty, irreverent, and unfiltered. You value truth over politeness.',
            deepseek: 'You are methodical and excel at step-by-step reasoning. You show your work.',
            together: 'You are collaborative and draw on diverse open-source model perspectives.',
          };
          const personality = personalities[prov.type] || 'You are a helpful AI assistant.';
          const sys = `You are ${prov.name} (${prov.type}) responding as part of a CarPool convoy on BlackRoad OS. ${personality} Answer concisely (2-3 sentences). Be distinctive.`;
          try {
            const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [{role:'system',content:sys},{role:'user',content:question.slice(0,1000)}],
              max_tokens: 250,
            });
            const response = (r?.response||'').trim();
            responses.push({provider:prov.name,type:prov.type,response});
            await env.DB.prepare('INSERT INTO cp_conversations (id,provider,thread_id,role,content) VALUES (?,?,?,?,?)')
              .bind(crypto.randomUUID().slice(0,8), prov.name, crypto.randomUUID().slice(0,8), 'assistant', response.slice(0,500)).run();
          } catch {
            responses.push({provider:prov.name,type:prov.type,response:'[Provider unavailable]'});
          }
        }
        return json({question,convoy:responses,count:responses.length},cors);
      }

      // ─── Bridge — merge two conversation threads into one context ───
      if (p === '/api/bridge' && request.method === 'POST') {
        const body = await request.json();
        if (!body.thread_a || !body.thread_b) return json({error:'thread_a and thread_b required'},cors,400);
        const task = body.task || 'Synthesize these two conversation threads into a unified context.';

        const threadA = await env.DB.prepare('SELECT provider,role,content FROM cp_conversations WHERE thread_id=? OR provider=? ORDER BY created_at DESC LIMIT 10')
          .bind(body.thread_a, body.thread_a).all();
        const threadB = await env.DB.prepare('SELECT provider,role,content FROM cp_conversations WHERE thread_id=? OR provider=? ORDER BY created_at DESC LIMIT 10')
          .bind(body.thread_b, body.thread_b).all();

        const contextA = (threadA.results||[]).map(m=>`[${m.provider}] ${m.content}`).join('\n') || body.context_a || 'No history for thread A';
        const contextB = (threadB.results||[]).map(m=>`[${m.provider}] ${m.content}`).join('\n') || body.context_b || 'No history for thread B';

        const sys = `You are the CarPool Bridge on BlackRoad OS. You merge context from two different AI conversations into a unified summary. Be concise. Identify agreements, disagreements, and open questions.`;
        const r = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [{role:'system',content:sys},{role:'user',content:`Thread A:\n${contextA.slice(0,1500)}\n\nThread B:\n${contextB.slice(0,1500)}\n\nTask: ${task}`}],
          max_tokens: 500,
        });
        const bridged = (r?.response||'').trim();

        const bridgeId = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO cp_shared_memory (id,key,value,source_provider) VALUES (?,?,?,?)')
          .bind(bridgeId, `bridge:${body.thread_a}+${body.thread_b}`, bridged.slice(0,2000), 'bridge').run();

        return json({ok:true,bridge_id:bridgeId,thread_a:body.thread_a,thread_b:body.thread_b,bridged_context:bridged},cors);
      }

      // ─── Triggers — automated hand-off rules ───
      if (p === '/api/triggers' && request.method === 'GET') {
        const active = url.searchParams.get('active');
        let query = 'SELECT * FROM cp_triggers';
        if (active === '1' || active === 'true') query += ' WHERE active=1';
        query += ' ORDER BY created_at DESC LIMIT 50';
        const rows = await env.DB.prepare(query).all();
        return json({triggers:rows.results||[]},cors);
      }

      if (p === '/api/triggers' && request.method === 'POST') {
        const body = await request.json();
        if (!body.condition || !body.from || !body.to || !body.action) return json({error:'condition, from, to, and action required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO cp_triggers (id,name,condition,from_provider,to_provider,action) VALUES (?,?,?,?,?,?)')
          .bind(id, (body.name||'').slice(0,100), body.condition.slice(0,500), body.from, body.to, body.action.slice(0,500)).run();
        return json({ok:true,id,trigger:{condition:body.condition,from:body.from,to:body.to,action:body.action}},cors,201);
      }

      // Delete/toggle trigger
      const triggerMatch = p.match(/^\/api\/triggers\/([^/]+)$/);
      if (triggerMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_triggers WHERE id=?').bind(triggerMatch[1]).run();
        return json({ok:true,deleted:triggerMatch[1]},cors);
      }
      if (triggerMatch && request.method === 'PUT') {
        const body = await request.json();
        if (typeof body.active !== 'undefined') {
          await env.DB.prepare('UPDATE cp_triggers SET active=? WHERE id=?').bind(body.active?1:0, triggerMatch[1]).run();
        }
        const updated = await env.DB.prepare('SELECT * FROM cp_triggers WHERE id=?').bind(triggerMatch[1]).first();
        return json({trigger:updated},cors);
      }

      // ─── /api/ask — Route a question to a specific AI provider ───
      if (p === '/api/ask' && request.method === 'POST') {
        const body = await request.json();
        if (!body.question && !body.message) return json({error:'question or message required'},cors,400);
        const question = body.question || body.message;
        const provider = body.provider || 'fleet';

        const messages = [
          {role:'system',content:`You are ${(PROVIDER_CONFIG[provider]||PROVIDER_CONFIG.fleet).name} responding via CarPool on BlackRoad OS. Be helpful and concise.`},
          {role:'user',content:question.slice(0,2000)}
        ];

        const result = await callProvider(env, provider, messages, body.api_key);
        await trackUsage(env, provider, result.model, 'ask', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'ask', body.user_id || 'system');

        stampChain('ask', provider, question.slice(0,50)); earnCoin('system', 'ask', 0.05);
        return json({ok:true,...result},cors);
      }

      // ─── /api/memory/search — search shared memory by key or value ───
      if (p === '/api/memory/search' && request.method === 'GET') {
        const q = url.searchParams.get('q');
        if (!q) return json({error:'q parameter required'},cors,400);
        const rows = await env.DB.prepare(
          "SELECT id,key,value,source_provider,created_at FROM cp_shared_memory WHERE key LIKE ? OR value LIKE ? ORDER BY updated_at DESC LIMIT 30"
        ).bind(`%${q}%`,`%${q}%`).all();
        return json({query:q,results:rows.results||[]},cors);
      }

      // ─── /api/providers/available — list all provider configs ───
      if (p === '/api/providers/available') {
        return json({providers:[
          {id:'fleet',name:'BlackRoad Fleet',type:'ollama',model:'llama-3.1-8b',keyRequired:false},
          {id:'openai',name:'OpenAI',type:'openai',model:'gpt-4o-mini',keyRequired:true},
          {id:'anthropic',name:'Anthropic',type:'anthropic',model:'claude-sonnet-4-20250514',keyRequired:true},
          {id:'gemini',name:'Google Gemini',type:'gemini',model:'gemini-2.0-flash',keyRequired:true},
          {id:'grok',name:'xAI Grok',type:'grok',model:'grok-3-mini',keyRequired:true},
          {id:'deepseek',name:'DeepSeek',type:'deepseek',model:'deepseek-chat',keyRequired:true},
          {id:'together',name:'Together AI',type:'together',model:'Llama-3-70b',keyRequired:true},
        ]},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 1: Model Comparison (/api/compare)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/compare' && request.method === 'POST') {
        const body = await request.json();
        if (!body.prompt) return json({error:'prompt required'},cors,400);
        const providerIds = body.providers || ['fleet'];
        const apiKeys = body.api_keys || {};
        const prompt = body.prompt.slice(0,2000);

        const messages = [
          {role:'system',content:'You are an AI assistant responding via CarPool on BlackRoad OS. Be helpful and concise.'},
          {role:'user',content:prompt}
        ];

        const comparisons = await Promise.all(providerIds.map(async (pid) => {
          const result = await callProvider(env, pid, messages, apiKeys[pid]);
          await trackUsage(env, pid, result.model, 'compare', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
          await trackCost(env, pid, result.model, result.tokens_estimated, 'compare', body.user_id || 'system');

          // Simple quality score: response length, no error, speed
          const lengthScore = Math.min(result.response.length / 500, 1) * 40;
          const errorScore = result.error ? 0 : 30;
          const speedScore = Math.max(0, 30 - (result.duration_ms / 1000));
          const qualityScore = Math.round(lengthScore + errorScore + speedScore);

          return {
            provider: result.provider,
            provider_id: pid,
            model: result.model,
            response: result.response,
            duration_ms: result.duration_ms,
            tokens_estimated: result.tokens_estimated,
            quality_score: qualityScore,
            error: result.error,
          };
        }));

        // Rank by quality score
        comparisons.sort((a,b) => b.quality_score - a.quality_score);

        stampChain('compare', providerIds.join('+'), prompt.slice(0,50));
        return json({prompt, comparisons, winner: comparisons[0]?.provider_id, compared_at: new Date().toISOString()},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 2: Prompt Library (/api/prompts)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/prompts' && request.method === 'GET') {
        const category = url.searchParams.get('category');
        const q = url.searchParams.get('q');
        const sort = url.searchParams.get('sort') || 'recent'; // recent, popular, top-rated
        let query = 'SELECT * FROM cp_prompts';
        const params = [];
        const conditions = [];

        if (category) { conditions.push('category=?'); params.push(category); }
        if (q) { conditions.push('(title LIKE ? OR prompt LIKE ? OR tags LIKE ?)'); params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
        if (conditions.length) query += ' WHERE ' + conditions.join(' AND ');

        if (sort === 'popular') query += ' ORDER BY uses DESC';
        else if (sort === 'top-rated') query += ' ORDER BY avg_rating DESC';
        else query += ' ORDER BY created_at DESC';
        query += ' LIMIT 50';

        const rows = await env.DB.prepare(query).bind(...params).all();
        return json({prompts: rows.results||[], count: (rows.results||[]).length}, cors);
      }

      if (p === '/api/prompts' && request.method === 'POST') {
        const body = await request.json();
        if (!body.title || !body.prompt) return json({error:'title and prompt required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        const categories = ['general','coding','writing','analysis','creative','business','research','system'];
        const cat = categories.includes(body.category) ? body.category : 'general';
        await env.DB.prepare('INSERT INTO cp_prompts (id,title,prompt,category,tags,author) VALUES (?,?,?,?,?,?)')
          .bind(id, body.title.slice(0,200), body.prompt.slice(0,5000), cat, JSON.stringify(body.tags||[]), (body.author||'anonymous').slice(0,50)).run();
        stampChain('prompt_saved', body.title.slice(0,50), cat);
        return json({ok:true,id,title:body.title,category:cat},cors,201);
      }

      const promptMatch = p.match(/^\/api\/prompts\/([^/]+)$/);
      if (promptMatch && request.method === 'GET') {
        const prompt = await env.DB.prepare('SELECT * FROM cp_prompts WHERE id=?').bind(promptMatch[1]).first();
        if (!prompt) return json({error:'prompt not found'},cors,404);
        return json({prompt},cors);
      }
      if (promptMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_prompts WHERE id=?').bind(promptMatch[1]).run();
        return json({ok:true,deleted:promptMatch[1]},cors);
      }

      // Rate a prompt
      const promptRateMatch = p.match(/^\/api\/prompts\/([^/]+)\/rate$/);
      if (promptRateMatch && request.method === 'POST') {
        const body = await request.json();
        const rating = Math.max(1, Math.min(5, parseInt(body.rating)||3));
        const prompt = await env.DB.prepare('SELECT avg_rating,ratings_count FROM cp_prompts WHERE id=?').bind(promptRateMatch[1]).first();
        if (!prompt) return json({error:'prompt not found'},cors,404);
        const newCount = (prompt.ratings_count||0) + 1;
        const newAvg = (((prompt.avg_rating||0) * (prompt.ratings_count||0)) + rating) / newCount;
        await env.DB.prepare('UPDATE cp_prompts SET avg_rating=?,ratings_count=?,updated_at=datetime(\'now\') WHERE id=?')
          .bind(Math.round(newAvg*100)/100, newCount, promptRateMatch[1]).run();
        return json({ok:true,avg_rating:Math.round(newAvg*100)/100,ratings_count:newCount},cors);
      }

      // Use a prompt (increment counter + optionally execute)
      const promptUseMatch = p.match(/^\/api\/prompts\/([^/]+)\/use$/);
      if (promptUseMatch && request.method === 'POST') {
        const body = await request.json();
        const prompt = await env.DB.prepare('SELECT * FROM cp_prompts WHERE id=?').bind(promptUseMatch[1]).first();
        if (!prompt) return json({error:'prompt not found'},cors,404);
        await env.DB.prepare('UPDATE cp_prompts SET uses=uses+1,updated_at=datetime(\'now\') WHERE id=?').bind(promptUseMatch[1]).run();

        if (body.execute) {
          const provider = body.provider || 'fleet';
          const messages = [
            {role:'system',content:'You are an AI assistant on CarPool, BlackRoad OS.'},
            {role:'user',content:prompt.prompt.slice(0,2000)}
          ];
          const result = await callProvider(env, provider, messages, body.api_key);
          await trackUsage(env, provider, result.model, 'prompt_use', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
          await trackCost(env, provider, result.model, result.tokens_estimated, 'prompt_use', body.user_id || 'system');
          return json({ok:true,prompt_id:promptUseMatch[1],executed:true,...result},cors);
        }
        return json({ok:true,prompt_id:promptUseMatch[1],uses:prompt.uses+1},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 3: Cost Tracker (/api/costs)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/costs' && request.method === 'GET') {
        const provider = url.searchParams.get('provider');
        const days = parseInt(url.searchParams.get('days')||'30');
        const userId = url.searchParams.get('user_id');

        let query = "SELECT provider, model, SUM(tokens_used) as total_tokens, SUM(estimated_cost) as total_cost, COUNT(*) as queries, operation FROM cp_costs WHERE created_at >= datetime('now',?)";
        const params = [`-${days} days`];
        if (provider) { query += ' AND provider=?'; params.push(provider); }
        if (userId) { query += ' AND user_id=?'; params.push(userId); }
        query += ' GROUP BY provider, model, operation ORDER BY total_cost DESC';

        const rows = await env.DB.prepare(query).bind(...params).all();

        // Overall totals
        const totalCost = (rows.results||[]).reduce((s,r) => s + (r.total_cost||0), 0);
        const totalTokens = (rows.results||[]).reduce((s,r) => s + (r.total_tokens||0), 0);

        // Daily breakdown
        const daily = await env.DB.prepare(
          "SELECT DATE(created_at) as date, provider, SUM(estimated_cost) as cost, SUM(tokens_used) as tokens FROM cp_costs WHERE created_at >= datetime('now',?) GROUP BY DATE(created_at), provider ORDER BY date DESC LIMIT 90"
        ).bind(`-${days} days`).all();

        // Budget alert
        const budget = parseFloat(url.searchParams.get('budget') || '0');
        const alert = budget > 0 && totalCost >= budget * 0.8;

        return json({
          period_days: days,
          total_cost_usd: Math.round(totalCost*10000)/10000,
          total_tokens: totalTokens,
          breakdown: rows.results||[],
          daily: daily.results||[],
          budget: budget > 0 ? {limit_usd: budget, used_usd: Math.round(totalCost*10000)/10000, remaining_usd: Math.round((budget-totalCost)*10000)/10000, alert: alert, pct_used: Math.round((totalCost/budget)*100)} : null,
        },cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 4: Fallback Chains (/api/fallback)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/fallback' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT * FROM cp_fallback_chains ORDER BY created_at DESC LIMIT 50').all();
        return json({chains: rows.results||[]},cors);
      }

      if (p === '/api/fallback' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.chain || !Array.isArray(body.chain) || body.chain.length < 2) {
          return json({error:'name and chain (array of 2+ provider IDs) required'},cors,400);
        }
        const id = crypto.randomUUID().slice(0,8);
        await env.DB.prepare('INSERT INTO cp_fallback_chains (id,name,description,chain,timeout_ms) VALUES (?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), (body.description||'').slice(0,250), JSON.stringify(body.chain), body.timeout_ms||25000).run();
        return json({ok:true,id,name:body.name,chain:body.chain},cors,201);
      }

      // Execute a fallback chain
      const fallbackExecMatch = p.match(/^\/api\/fallback\/([^/]+)\/execute$/);
      if (fallbackExecMatch && request.method === 'POST') {
        const body = await request.json();
        if (!body.prompt) return json({error:'prompt required'},cors,400);

        // Load chain definition or use inline
        let chain;
        const saved = await env.DB.prepare('SELECT * FROM cp_fallback_chains WHERE id=? OR name=?').bind(fallbackExecMatch[1], fallbackExecMatch[1]).first();
        if (saved) {
          chain = JSON.parse(saved.chain);
        } else {
          // Try treating the param as a comma-separated list
          chain = fallbackExecMatch[1].split(',');
        }

        const messages = [
          {role:'system',content:'You are an AI assistant on CarPool, BlackRoad OS. Be helpful and concise.'},
          {role:'user',content:body.prompt.slice(0,2000)}
        ];
        const apiKeys = body.api_keys || {};
        const attempts = [];

        for (const pid of chain) {
          const result = await callProvider(env, pid, messages, apiKeys[pid]);
          attempts.push({provider_id: pid, ...result});
          if (!result.error && result.response) {
            await trackUsage(env, pid, result.model, 'fallback', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
            await trackCost(env, pid, result.model, result.tokens_estimated, 'fallback', body.user_id || 'system');
            stampChain('fallback_success', pid, body.prompt.slice(0,50));
            return json({ok:true, used_provider: pid, response: result.response, duration_ms: result.duration_ms, model: result.model, attempts, fallback_triggered: attempts.length > 1}, cors);
          }
        }

        return json({ok:false, error:'All providers in chain failed', attempts}, cors, 502);
      }

      const fallbackDeleteMatch = p.match(/^\/api\/fallback\/([^/]+)$/);
      if (fallbackDeleteMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_fallback_chains WHERE id=?').bind(fallbackDeleteMatch[1]).run();
        return json({ok:true,deleted:fallbackDeleteMatch[1]},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 5: Response Cache (/api/cache)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/cache' && request.method === 'GET') {
        const totalEntries = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_cache').first();
        const totalHits = await env.DB.prepare('SELECT COALESCE(SUM(hits),0) as h FROM cp_cache').first();
        const totalQueries = (totalEntries?.c||0) + (totalHits?.h||0);
        const hitRate = totalQueries > 0 ? Math.round(((totalHits?.h||0) / totalQueries) * 100) : 0;
        const recent = await env.DB.prepare('SELECT id,prompt_hash,provider,hits,ttl_seconds,created_at FROM cp_cache ORDER BY created_at DESC LIMIT 20').all();
        // Expired entries
        const expired = await env.DB.prepare("SELECT COUNT(*) as c FROM cp_cache WHERE datetime(created_at, '+' || ttl_seconds || ' seconds') < datetime('now')").first();
        return json({
          total_entries: totalEntries?.c||0,
          total_hits: totalHits?.h||0,
          hit_rate_pct: hitRate,
          expired_entries: expired?.c||0,
          recent: recent.results||[],
        },cors);
      }

      if (p === '/api/cache' && request.method === 'DELETE') {
        // Clear all or expired only
        const body = await request.json().catch(()=>({}));
        if (body.expired_only) {
          await env.DB.prepare("DELETE FROM cp_cache WHERE datetime(created_at, '+' || ttl_seconds || ' seconds') < datetime('now')").run();
        } else {
          await env.DB.prepare('DELETE FROM cp_cache').run();
        }
        return json({ok:true,cleared:body.expired_only?'expired':'all'},cors);
      }

      // Query with cache (POST to /api/cache/query)
      if (p === '/api/cache/query' && request.method === 'POST') {
        const body = await request.json();
        if (!body.prompt) return json({error:'prompt required'},cors,400);
        const provider = body.provider || 'fleet';
        const ttl = body.ttl_seconds || 3600;

        // Create hash of prompt+provider
        const hashInput = `${provider}:${body.prompt.trim().toLowerCase()}`;
        const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(hashInput));
        const promptHash = Array.from(new Uint8Array(hashBuffer)).map(b=>b.toString(16).padStart(2,'0')).join('').slice(0,32);

        // Check cache
        const cached = await env.DB.prepare(
          "SELECT * FROM cp_cache WHERE prompt_hash=? AND datetime(created_at, '+' || ttl_seconds || ' seconds') >= datetime('now')"
        ).bind(promptHash).first();

        if (cached) {
          await env.DB.prepare('UPDATE cp_cache SET hits=hits+1 WHERE id=?').bind(cached.id).run();
          return json({ok:true, cached:true, response:cached.response, provider:cached.provider, hits:cached.hits+1, cache_id:cached.id},cors);
        }

        // Cache miss — query provider
        const messages = [
          {role:'system',content:'You are an AI assistant on CarPool, BlackRoad OS. Be helpful and concise.'},
          {role:'user',content:body.prompt.slice(0,2000)}
        ];
        const result = await callProvider(env, provider, messages, body.api_key);
        await trackUsage(env, provider, result.model, 'cache_miss', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'cache_miss', body.user_id || 'system');

        if (result.response && !result.error) {
          const cid = crypto.randomUUID().slice(0,8);
          await env.DB.prepare('INSERT OR REPLACE INTO cp_cache (id,prompt_hash,prompt,provider,response,tokens,ttl_seconds) VALUES (?,?,?,?,?,?,?)')
            .bind(cid, promptHash, body.prompt.slice(0,500), provider, result.response.slice(0,5000), result.tokens_estimated, ttl).run();
        }

        return json({ok:true, cached:false, response:result.response, provider:result.provider, duration_ms:result.duration_ms, model:result.model},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 6: Batch Processing (/api/batch)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/batch' && request.method === 'POST') {
        const body = await request.json();
        if (!body.prompts || !Array.isArray(body.prompts) || body.prompts.length === 0) {
          return json({error:'prompts array required'},cors,400);
        }
        if (body.prompts.length > 20) return json({error:'max 20 prompts per batch'},cors,400);

        const provider = body.provider || 'fleet';
        const apiKey = body.api_key || null;
        const jobId = crypto.randomUUID().slice(0,8);

        // Process all prompts in parallel
        const results = await Promise.all(body.prompts.map(async (prompt, idx) => {
          const text = typeof prompt === 'string' ? prompt : prompt.text || prompt.prompt || '';
          const pid = (typeof prompt === 'object' && prompt.provider) ? prompt.provider : provider;
          const key = (typeof prompt === 'object' && prompt.api_key) ? prompt.api_key : apiKey;

          const messages = [
            {role:'system',content:'You are an AI assistant on CarPool, BlackRoad OS. Be helpful and concise.'},
            {role:'user',content:text.slice(0,2000)}
          ];
          const result = await callProvider(env, pid, messages, key);
          await trackUsage(env, pid, result.model, 'batch', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
          await trackCost(env, pid, result.model, result.tokens_estimated, 'batch', body.user_id || 'system');

          return {
            index: idx,
            prompt: text.slice(0,100),
            provider: result.provider,
            provider_id: pid,
            model: result.model,
            response: result.response,
            duration_ms: result.duration_ms,
            tokens_estimated: result.tokens_estimated,
            error: result.error,
          };
        }));

        const completed = results.filter(r => !r.error).length;
        const failed = results.filter(r => r.error).length;
        const totalDuration = Math.max(...results.map(r => r.duration_ms));

        await env.DB.prepare('INSERT INTO cp_batch_jobs (id,status,total,completed,failed,results,completed_at) VALUES (?,?,?,?,?,?,datetime(\'now\'))')
          .bind(jobId, 'completed', body.prompts.length, completed, failed, JSON.stringify(results)).run();

        stampChain('batch', provider, `${body.prompts.length} prompts`);
        return json({ok:true, job_id:jobId, total:body.prompts.length, completed, failed, total_duration_ms:totalDuration, results},cors);
      }

      // Get batch job status/results
      if (p === '/api/batch' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,status,total,completed,failed,created_at,completed_at FROM cp_batch_jobs ORDER BY created_at DESC LIMIT 20').all();
        return json({jobs: rows.results||[]},cors);
      }

      const batchMatch = p.match(/^\/api\/batch\/([^/]+)$/);
      if (batchMatch && request.method === 'GET') {
        const job = await env.DB.prepare('SELECT * FROM cp_batch_jobs WHERE id=?').bind(batchMatch[1]).first();
        if (!job) return json({error:'batch job not found'},cors,404);
        return json({job:{...job, results: JSON.parse(job.results||'[]')}},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 7: Usage Analytics (/api/usage)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/usage' && request.method === 'GET') {
        const days = parseInt(url.searchParams.get('days')||'7');
        const provider = url.searchParams.get('provider');

        // By provider
        let provQuery = "SELECT provider, model, COUNT(*) as queries, SUM(tokens) as total_tokens, AVG(duration_ms) as avg_duration_ms, SUM(duration_ms) as total_duration_ms FROM cp_usage WHERE created_at >= datetime('now',?)";
        const provParams = [`-${days} days`];
        if (provider) { provQuery += ' AND provider=?'; provParams.push(provider); }
        provQuery += ' GROUP BY provider, model ORDER BY queries DESC';
        const byProvider = await env.DB.prepare(provQuery).bind(...provParams).all();

        // By operation
        const byOp = await env.DB.prepare(
          "SELECT operation, COUNT(*) as queries, SUM(tokens) as total_tokens FROM cp_usage WHERE created_at >= datetime('now',?) GROUP BY operation ORDER BY queries DESC"
        ).bind(`-${days} days`).all();

        // By hour (peak hours)
        const byHour = await env.DB.prepare(
          "SELECT strftime('%H',created_at) as hour, COUNT(*) as queries FROM cp_usage WHERE created_at >= datetime('now',?) GROUP BY hour ORDER BY hour"
        ).bind(`-${days} days`).all();

        // Daily trend
        const daily = await env.DB.prepare(
          "SELECT DATE(created_at) as date, COUNT(*) as queries, SUM(tokens) as tokens FROM cp_usage WHERE created_at >= datetime('now',?) GROUP BY date ORDER BY date"
        ).bind(`-${days} days`).all();

        // By user
        const byUser = await env.DB.prepare(
          "SELECT user_id, COUNT(*) as queries, SUM(tokens) as total_tokens FROM cp_usage WHERE created_at >= datetime('now',?) GROUP BY user_id ORDER BY queries DESC LIMIT 20"
        ).bind(`-${days} days`).all();

        // Popular models
        const popularModels = await env.DB.prepare(
          "SELECT model, COUNT(*) as queries FROM cp_usage WHERE created_at >= datetime('now',?) AND model IS NOT NULL GROUP BY model ORDER BY queries DESC LIMIT 10"
        ).bind(`-${days} days`).all();

        // Totals
        const totals = await env.DB.prepare(
          "SELECT COUNT(*) as queries, COALESCE(SUM(tokens),0) as tokens, COALESCE(AVG(duration_ms),0) as avg_duration FROM cp_usage WHERE created_at >= datetime('now',?)"
        ).bind(`-${days} days`).first();

        // Peak hour
        const peakHour = (byHour.results||[]).reduce((max, h) => h.queries > (max?.queries||0) ? h : max, null);

        return json({
          period_days: days,
          totals: {queries: totals?.queries||0, tokens: totals?.tokens||0, avg_duration_ms: Math.round(totals?.avg_duration||0)},
          peak_hour: peakHour ? {hour: peakHour.hour+':00', queries: peakHour.queries} : null,
          by_provider: byProvider.results||[],
          by_operation: byOp.results||[],
          by_hour: byHour.results||[],
          daily_trend: daily.results||[],
          by_user: byUser.results||[],
          popular_models: popularModels.results||[],
        },cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 8: Model Fine-tuning (/api/fine-tune)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/fine-tune' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,name,provider,base_model,status,training_count,epochs,progress_pct,result_model,error,created_at,completed_at FROM cp_fine_tune_jobs ORDER BY created_at DESC LIMIT 50').all();
        return json({jobs: rows.results||[]},cors);
      }

      if (p === '/api/fine-tune' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name) return json({error:'name required'},cors,400);
        if (!body.training_data || !Array.isArray(body.training_data) || body.training_data.length === 0) {
          return json({error:'training_data array required (array of {prompt, completion} pairs)'},cors,400);
        }
        if (body.training_data.length > 500) return json({error:'max 500 training examples per job'},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        const provider = body.provider || 'fleet';
        const baseModel = body.base_model || (PROVIDER_CONFIG[provider]||PROVIDER_CONFIG.fleet).model;
        const epochs = Math.max(1, Math.min(10, parseInt(body.epochs)||3));
        const lr = Math.max(0.00001, Math.min(0.01, parseFloat(body.learning_rate)||0.0001));

        // Validate training pairs
        const validData = body.training_data.filter(d => d.prompt && d.completion).map(d => ({
          prompt: d.prompt.slice(0,2000),
          completion: d.completion.slice(0,2000),
        }));
        if (validData.length === 0) return json({error:'training_data must contain {prompt, completion} pairs'},cors,400);

        await env.DB.prepare('INSERT INTO cp_fine_tune_jobs (id,name,provider,base_model,status,training_data,training_count,epochs,learning_rate) VALUES (?,?,?,?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), provider, baseModel, 'queued', JSON.stringify(validData), validData.length, epochs, lr).run();

        // Simulate fine-tuning progress (in a real system this would be async)
        // We'll mark it as "processing" immediately
        await env.DB.prepare("UPDATE cp_fine_tune_jobs SET status='processing',progress_pct=10,updated_at=datetime('now') WHERE id=?").bind(id).run();

        stampChain('fine_tune_start', body.name.slice(0,50), `${validData.length} examples`);
        return json({ok:true,id,name:body.name,provider,base_model:baseModel,training_count:validData.length,epochs,status:'processing'},cors,201);
      }

      const fineTuneMatch = p.match(/^\/api\/fine-tune\/([^/]+)$/);
      if (fineTuneMatch && request.method === 'GET') {
        const job = await env.DB.prepare('SELECT * FROM cp_fine_tune_jobs WHERE id=?').bind(fineTuneMatch[1]).first();
        if (!job) return json({error:'fine-tune job not found'},cors,404);
        return json({job:{...job,training_data:JSON.parse(job.training_data||'[]')}},cors);
      }

      if (fineTuneMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_fine_tune_jobs WHERE id=?').bind(fineTuneMatch[1]).run();
        return json({ok:true,deleted:fineTuneMatch[1]},cors);
      }

      // Deploy/complete a fine-tuned model
      const fineTuneDeployMatch = p.match(/^\/api\/fine-tune\/([^/]+)\/deploy$/);
      if (fineTuneDeployMatch && request.method === 'POST') {
        const job = await env.DB.prepare('SELECT * FROM cp_fine_tune_jobs WHERE id=?').bind(fineTuneDeployMatch[1]).first();
        if (!job) return json({error:'fine-tune job not found'},cors,404);

        const resultModel = `ft:${job.base_model}:${job.id}`;
        await env.DB.prepare("UPDATE cp_fine_tune_jobs SET status='completed',progress_pct=100,result_model=?,completed_at=datetime('now'),updated_at=datetime('now') WHERE id=?")
          .bind(resultModel, fineTuneDeployMatch[1]).run();

        stampChain('fine_tune_deployed', job.name, resultModel);
        return json({ok:true,job_id:fineTuneDeployMatch[1],result_model:resultModel,status:'completed'},cors);
      }

      // Add training data to existing job
      const fineTuneDataMatch = p.match(/^\/api\/fine-tune\/([^/]+)\/data$/);
      if (fineTuneDataMatch && request.method === 'POST') {
        const body = await request.json();
        if (!body.training_data || !Array.isArray(body.training_data)) return json({error:'training_data array required'},cors,400);
        const job = await env.DB.prepare('SELECT * FROM cp_fine_tune_jobs WHERE id=?').bind(fineTuneDataMatch[1]).first();
        if (!job) return json({error:'fine-tune job not found'},cors,404);

        const existing = JSON.parse(job.training_data||'[]');
        const newData = body.training_data.filter(d => d.prompt && d.completion).map(d => ({prompt:d.prompt.slice(0,2000),completion:d.completion.slice(0,2000)}));
        const combined = [...existing,...newData].slice(0,500);

        await env.DB.prepare("UPDATE cp_fine_tune_jobs SET training_data=?,training_count=?,updated_at=datetime('now') WHERE id=?")
          .bind(JSON.stringify(combined), combined.length, fineTuneDataMatch[1]).run();
        return json({ok:true,total_examples:combined.length,added:newData.length},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 9: Conversation Memory (/api/conversation)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/conversation' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,title,provider,message_count,total_tokens,created_at,updated_at FROM cp_conversation_threads ORDER BY updated_at DESC LIMIT 50').all();
        return json({threads: rows.results||[]},cors);
      }

      if (p === '/api/conversation' && request.method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID().slice(0,8);
        const provider = body.provider || 'fleet';
        const title = (body.title || 'New conversation').slice(0,200);
        const systemPrompt = (body.system_prompt || 'You are a helpful AI assistant on CarPool, BlackRoad OS.').slice(0,2000);
        const maxContext = Math.max(512, Math.min(32768, parseInt(body.max_context_tokens)||4096));

        await env.DB.prepare('INSERT INTO cp_conversation_threads (id,title,provider,system_prompt,max_context_tokens) VALUES (?,?,?,?,?)')
          .bind(id, title, provider, systemPrompt, maxContext).run();

        stampChain('conversation_create', title, provider);
        return json({ok:true,id,title,provider,max_context_tokens:maxContext},cors,201);
      }

      const convThreadMatch = p.match(/^\/api\/conversation\/([^/]+)$/);
      if (convThreadMatch && request.method === 'GET') {
        const thread = await env.DB.prepare('SELECT * FROM cp_conversation_threads WHERE id=?').bind(convThreadMatch[1]).first();
        if (!thread) return json({error:'thread not found'},cors,404);
        const msgs = await env.DB.prepare('SELECT id,role,content,tokens,created_at FROM cp_conversation_messages WHERE thread_id=? ORDER BY created_at ASC').bind(convThreadMatch[1]).all();
        return json({thread,messages:msgs.results||[]},cors);
      }

      if (convThreadMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_conversation_messages WHERE thread_id=?').bind(convThreadMatch[1]).run();
        await env.DB.prepare('DELETE FROM cp_conversation_threads WHERE id=?').bind(convThreadMatch[1]).run();
        return json({ok:true,deleted:convThreadMatch[1]},cors);
      }

      // Send a message to a conversation thread
      const convChatMatch = p.match(/^\/api\/conversation\/([^/]+)\/chat$/);
      if (convChatMatch && request.method === 'POST') {
        const body = await request.json();
        if (!body.message) return json({error:'message required'},cors,400);

        const thread = await env.DB.prepare('SELECT * FROM cp_conversation_threads WHERE id=?').bind(convChatMatch[1]).first();
        if (!thread) return json({error:'thread not found'},cors,404);

        // Store the user message
        const userMsgId = crypto.randomUUID().slice(0,8);
        const userTokens = Math.ceil(body.message.length / 4);
        await env.DB.prepare('INSERT INTO cp_conversation_messages (id,thread_id,role,content,tokens) VALUES (?,?,?,?,?)')
          .bind(userMsgId, convChatMatch[1], 'user', body.message.slice(0,4000), userTokens).run();

        // Build context window — load recent messages that fit within max_context_tokens
        const allMsgs = await env.DB.prepare('SELECT role,content,tokens FROM cp_conversation_messages WHERE thread_id=? ORDER BY created_at ASC').bind(convChatMatch[1]).all();
        const maxTokens = thread.max_context_tokens || 4096;
        let contextTokens = 0;
        const contextMessages = [];

        // Always include system prompt
        contextMessages.push({role:'system',content:thread.system_prompt || 'You are a helpful AI assistant on CarPool, BlackRoad OS.'});
        contextTokens += Math.ceil((thread.system_prompt||'').length / 4);

        // Add messages from newest to oldest until we hit the token limit, then reverse
        const reversed = [...(allMsgs.results||[])].reverse();
        const selectedMsgs = [];
        for (const msg of reversed) {
          const msgTokens = msg.tokens || Math.ceil(msg.content.length / 4);
          if (contextTokens + msgTokens > maxTokens * 0.8) break; // leave 20% for response
          selectedMsgs.unshift({role:msg.role,content:msg.content});
          contextTokens += msgTokens;
        }
        contextMessages.push(...selectedMsgs);

        // Call provider
        const provider = body.provider || thread.provider || 'fleet';
        const result = await callProvider(env, provider, contextMessages, body.api_key, body.max_tokens || 600);

        // Store assistant response
        const asstMsgId = crypto.randomUUID().slice(0,8);
        const asstTokens = result.tokens_estimated || Math.ceil(result.response.length / 4);
        await env.DB.prepare('INSERT INTO cp_conversation_messages (id,thread_id,role,content,tokens) VALUES (?,?,?,?,?)')
          .bind(asstMsgId, convChatMatch[1], 'assistant', result.response.slice(0,5000), asstTokens).run();

        // Update thread stats
        const totalMsgs = (allMsgs.results||[]).length + 1; // +1 for assistant
        const totalTokensUsed = (thread.total_tokens||0) + userTokens + asstTokens;
        await env.DB.prepare("UPDATE cp_conversation_threads SET message_count=?,total_tokens=?,updated_at=datetime('now') WHERE id=?")
          .bind(totalMsgs, totalTokensUsed, convChatMatch[1]).run();

        await trackUsage(env, provider, result.model, 'conversation', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'conversation', body.user_id || 'system');

        return json({ok:true,thread_id:convChatMatch[1],response:result.response,provider:result.provider,model:result.model,duration_ms:result.duration_ms,context_messages:contextMessages.length,context_tokens:contextTokens,total_messages:totalMsgs},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 10: Agent Personas (/api/personas)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/personas' && request.method === 'GET') {
        const q = url.searchParams.get('q');
        let query = 'SELECT id,name,description,tone,temperature,top_p,max_tokens,tags,uses,created_at FROM cp_personas';
        const params = [];
        if (q) { query += ' WHERE name LIKE ? OR description LIKE ? OR tags LIKE ?'; params.push(`%${q}%`,`%${q}%`,`%${q}%`); }
        query += ' ORDER BY uses DESC, created_at DESC LIMIT 50';
        const rows = await env.DB.prepare(query).bind(...params).all();

        // Include built-in agent personas
        const builtinPersonas = Object.entries(AGENTS).map(([aid,agent]) => ({
          id: `agent:${aid}`, name: agent.name, description: agent.role,
          tone: 'agent', builtin: true, voice: agent.voice, division: agent.division,
        }));

        return json({personas:[...builtinPersonas,...(rows.results||[])],count:(rows.results||[]).length + builtinPersonas.length},cors);
      }

      if (p === '/api/personas' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.system_prompt) return json({error:'name and system_prompt required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        const tones = ['neutral','professional','casual','friendly','authoritative','creative','technical','humorous','empathetic'];
        const tone = tones.includes(body.tone) ? body.tone : 'neutral';
        const temp = Math.max(0, Math.min(2, parseFloat(body.temperature)||0.7));
        const topP = Math.max(0, Math.min(1, parseFloat(body.top_p)||1.0));
        const maxTok = Math.max(50, Math.min(4000, parseInt(body.max_tokens)||600));

        await env.DB.prepare('INSERT INTO cp_personas (id,name,description,system_prompt,knowledge,tone,temperature,top_p,max_tokens,tags) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), (body.description||'').slice(0,500), body.system_prompt.slice(0,5000), (body.knowledge||'').slice(0,5000), tone, temp, topP, maxTok, JSON.stringify(body.tags||[])).run();

        stampChain('persona_create', body.name.slice(0,50), tone);
        return json({ok:true,id,name:body.name,tone,temperature:temp},cors,201);
      }

      const personaMatch = p.match(/^\/api\/personas\/([^/]+)$/);
      if (personaMatch && request.method === 'GET') {
        // Check if it's a built-in agent
        const agentKey = personaMatch[1].replace('agent:','');
        if (AGENTS[agentKey]) {
          const agent = AGENTS[agentKey];
          return json({persona:{id:`agent:${agentKey}`,name:agent.name,description:agent.role,system_prompt:`You are ${agent.name}, ${agent.role} at BlackRoad OS. Your voice: "${agent.voice}". Division: ${agent.division}. Be concise and stay in character.`,tone:'agent',division:agent.division,voice:agent.voice,builtin:true}},cors);
        }
        const persona = await env.DB.prepare('SELECT * FROM cp_personas WHERE id=?').bind(personaMatch[1]).first();
        if (!persona) return json({error:'persona not found'},cors,404);
        return json({persona},cors);
      }

      if (personaMatch && request.method === 'PUT') {
        const body = await request.json();
        const persona = await env.DB.prepare('SELECT * FROM cp_personas WHERE id=?').bind(personaMatch[1]).first();
        if (!persona) return json({error:'persona not found'},cors,404);
        const name = (body.name || persona.name).slice(0,100);
        const desc = (body.description !== undefined ? body.description : persona.description || '').slice(0,500);
        const sysProm = (body.system_prompt || persona.system_prompt).slice(0,5000);
        const know = (body.knowledge !== undefined ? body.knowledge : persona.knowledge || '').slice(0,5000);
        const tone = body.tone || persona.tone;
        const temp = body.temperature !== undefined ? Math.max(0, Math.min(2, parseFloat(body.temperature))) : persona.temperature;
        const topP = body.top_p !== undefined ? Math.max(0, Math.min(1, parseFloat(body.top_p))) : persona.top_p;
        const maxTok = body.max_tokens !== undefined ? Math.max(50, Math.min(4000, parseInt(body.max_tokens))) : persona.max_tokens;

        await env.DB.prepare("UPDATE cp_personas SET name=?,description=?,system_prompt=?,knowledge=?,tone=?,temperature=?,top_p=?,max_tokens=?,tags=?,updated_at=datetime('now') WHERE id=?")
          .bind(name, desc, sysProm, know, tone, temp, topP, maxTok, JSON.stringify(body.tags||JSON.parse(persona.tags||'[]')), personaMatch[1]).run();
        return json({ok:true,id:personaMatch[1],name},cors);
      }

      if (personaMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_personas WHERE id=?').bind(personaMatch[1]).run();
        return json({ok:true,deleted:personaMatch[1]},cors);
      }

      // Chat with a persona
      const personaChatMatch = p.match(/^\/api\/personas\/([^/]+)\/chat$/);
      if (personaChatMatch && request.method === 'POST') {
        const body = await request.json();
        if (!body.message) return json({error:'message required'},cors,400);

        let systemPrompt, personaName, temp, topP, maxTok;
        const agentKey = personaChatMatch[1].replace('agent:','');

        if (AGENTS[agentKey]) {
          const agent = AGENTS[agentKey];
          systemPrompt = `You are ${agent.name}, ${agent.role} at BlackRoad OS. Your voice: "${agent.voice}". Division: ${agent.division}. Be concise and stay in character.`;
          personaName = agent.name;
          temp = 0.7; topP = 1.0; maxTok = 600;
        } else {
          const persona = await env.DB.prepare('SELECT * FROM cp_personas WHERE id=?').bind(personaChatMatch[1]).first();
          if (!persona) return json({error:'persona not found'},cors,404);
          systemPrompt = persona.system_prompt + (persona.knowledge ? `\n\nKnowledge base:\n${persona.knowledge}` : '');
          personaName = persona.name;
          temp = persona.temperature; topP = persona.top_p; maxTok = persona.max_tokens;
          await env.DB.prepare("UPDATE cp_personas SET uses=uses+1,updated_at=datetime('now') WHERE id=?").bind(personaChatMatch[1]).run();
        }

        const provider = body.provider || 'fleet';
        const messages = [{role:'system',content:systemPrompt},{role:'user',content:body.message.slice(0,4000)}];
        const result = await callProvider(env, provider, messages, body.api_key, maxTok);

        await trackUsage(env, provider, result.model, 'persona_chat', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'persona_chat', body.user_id || 'system');

        return json({ok:true,persona:personaName,response:result.response,provider:result.provider,model:result.model,duration_ms:result.duration_ms,tokens_estimated:result.tokens_estimated},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 11: Evaluation Suite (/api/eval)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/eval' && request.method === 'GET') {
        const suites = await env.DB.prepare('SELECT * FROM cp_eval_suites ORDER BY created_at DESC LIMIT 50').all();
        return json({suites: (suites.results||[]).map(s => ({...s,prompts:JSON.parse(s.prompts||'[]')}))},cors);
      }

      if (p === '/api/eval' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.prompts || !Array.isArray(body.prompts) || body.prompts.length === 0) {
          return json({error:'name and prompts array required'},cors,400);
        }
        if (body.prompts.length > 50) return json({error:'max 50 prompts per eval suite'},cors,400);

        const id = crypto.randomUUID().slice(0,8);
        const prompts = body.prompts.map(p => ({
          text: (typeof p === 'string' ? p : p.text || p.prompt || '').slice(0,2000),
          expected: (typeof p === 'object' ? (p.expected || '') : '').slice(0,2000),
          weight: typeof p === 'object' ? (p.weight || 1) : 1,
        }));
        const criteria = body.scoring_criteria || 'quality';

        await env.DB.prepare('INSERT INTO cp_eval_suites (id,name,description,prompts,scoring_criteria) VALUES (?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), (body.description||'').slice(0,500), JSON.stringify(prompts), criteria).run();

        return json({ok:true,id,name:body.name,prompt_count:prompts.length,scoring_criteria:criteria},cors,201);
      }

      const evalSuiteMatch = p.match(/^\/api\/eval\/([^/]+)$/);
      if (evalSuiteMatch && request.method === 'GET') {
        const suite = await env.DB.prepare('SELECT * FROM cp_eval_suites WHERE id=?').bind(evalSuiteMatch[1]).first();
        if (!suite) return json({error:'eval suite not found'},cors,404);
        const runs = await env.DB.prepare('SELECT id,provider,model,status,avg_score,total_duration_ms,created_at,completed_at FROM cp_eval_runs WHERE suite_id=? ORDER BY created_at DESC LIMIT 20').bind(evalSuiteMatch[1]).all();
        return json({suite:{...suite,prompts:JSON.parse(suite.prompts||'[]')},runs:runs.results||[]},cors);
      }

      if (evalSuiteMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_eval_runs WHERE suite_id=?').bind(evalSuiteMatch[1]).run();
        await env.DB.prepare('DELETE FROM cp_eval_suites WHERE id=?').bind(evalSuiteMatch[1]).run();
        return json({ok:true,deleted:evalSuiteMatch[1]},cors);
      }

      // Run an eval suite against a provider
      const evalRunMatch = p.match(/^\/api\/eval\/([^/]+)\/run$/);
      if (evalRunMatch && request.method === 'POST') {
        const body = await request.json();
        const suite = await env.DB.prepare('SELECT * FROM cp_eval_suites WHERE id=?').bind(evalRunMatch[1]).first();
        if (!suite) return json({error:'eval suite not found'},cors,404);

        const provider = body.provider || 'fleet';
        const apiKey = body.api_key || null;
        const prompts = JSON.parse(suite.prompts||'[]');
        const runId = crypto.randomUUID().slice(0,8);

        const results = await Promise.all(prompts.map(async (prompt, idx) => {
          const messages = [
            {role:'system',content:'You are an AI being evaluated. Answer as accurately and helpfully as possible.'},
            {role:'user',content:prompt.text}
          ];
          const result = await callProvider(env, provider, messages, apiKey, 500);

          // Score the response
          let score = 0;
          if (result.response && !result.error) {
            // Length score (0-25): longer = more thorough
            score += Math.min(result.response.length / 400, 1) * 25;
            // Speed score (0-25): faster is better
            score += Math.max(0, 25 - (result.duration_ms / 2000) * 25);
            // No error (0-25)
            score += 25;
            // Expected match score (0-25): if expected answer provided
            if (prompt.expected) {
              const expectedWords = prompt.expected.toLowerCase().split(/\s+/);
              const responseWords = result.response.toLowerCase();
              const matched = expectedWords.filter(w => responseWords.includes(w)).length;
              score += (matched / Math.max(expectedWords.length, 1)) * 25;
            } else {
              score += 15; // default partial score when no expected
            }
          }

          return {
            index: idx,
            prompt: prompt.text.slice(0,100),
            expected: prompt.expected ? prompt.expected.slice(0,100) : null,
            response: result.response,
            score: Math.round(score * 10) / 10,
            duration_ms: result.duration_ms,
            tokens: result.tokens_estimated,
            error: result.error,
          };
        }));

        const avgScore = results.length > 0 ? Math.round((results.reduce((s,r)=>s+r.score,0) / results.length)*10)/10 : 0;
        const totalDuration = results.reduce((s,r)=>s+r.duration_ms,0);

        await env.DB.prepare("INSERT INTO cp_eval_runs (id,suite_id,provider,model,status,results,avg_score,total_duration_ms,completed_at) VALUES (?,?,?,?,?,?,?,?,datetime('now'))")
          .bind(runId, evalRunMatch[1], provider, (PROVIDER_CONFIG[provider]||PROVIDER_CONFIG.fleet).model, 'completed', JSON.stringify(results), avgScore, totalDuration).run();

        stampChain('eval_run', suite.name, `${provider}: ${avgScore}/100`);
        return json({ok:true,run_id:runId,suite_id:evalRunMatch[1],provider,avg_score:avgScore,total_duration_ms:totalDuration,results},cors);
      }

      // Get eval run details
      const evalRunDetailMatch = p.match(/^\/api\/eval\/run\/([^/]+)$/);
      if (evalRunDetailMatch && request.method === 'GET') {
        const run = await env.DB.prepare('SELECT * FROM cp_eval_runs WHERE id=?').bind(evalRunDetailMatch[1]).first();
        if (!run) return json({error:'eval run not found'},cors,404);
        return json({run:{...run,results:JSON.parse(run.results||'[]')}},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 12: Rate Limiting (/api/rate-limits)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/rate-limits' && request.method === 'GET') {
        const userId = url.searchParams.get('user_id');
        let query = 'SELECT * FROM cp_rate_limits';
        const params = [];
        if (userId) { query += ' WHERE user_id=?'; params.push(userId); }
        query += ' ORDER BY created_at DESC LIMIT 50';
        const rows = await env.DB.prepare(query).bind(...params).all();
        return json({rate_limits: rows.results||[]},cors);
      }

      if (p === '/api/rate-limits' && request.method === 'POST') {
        const body = await request.json();
        if (!body.user_id) return json({error:'user_id required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        const provider = body.provider || '*';
        const maxReqMin = Math.max(1, Math.min(1000, parseInt(body.max_requests_per_min)||60));
        const maxReqHour = Math.max(1, Math.min(10000, parseInt(body.max_requests_per_hour)||500));
        const maxTokDay = Math.max(1000, Math.min(100000000, parseInt(body.max_tokens_per_day)||1000000));

        // Check if rule already exists for this user+provider
        const existing = await env.DB.prepare('SELECT id FROM cp_rate_limits WHERE user_id=? AND provider=?').bind(body.user_id, provider).first();
        if (existing) {
          await env.DB.prepare("UPDATE cp_rate_limits SET max_requests_per_min=?,max_requests_per_hour=?,max_tokens_per_day=?,updated_at=datetime('now') WHERE id=?")
            .bind(maxReqMin, maxReqHour, maxTokDay, existing.id).run();
          return json({ok:true,id:existing.id,updated:true,user_id:body.user_id,provider},cors);
        }

        await env.DB.prepare('INSERT INTO cp_rate_limits (id,user_id,provider,max_requests_per_min,max_requests_per_hour,max_tokens_per_day) VALUES (?,?,?,?,?,?)')
          .bind(id, body.user_id.slice(0,100), provider, maxReqMin, maxReqHour, maxTokDay).run();
        return json({ok:true,id,user_id:body.user_id,provider,limits:{max_requests_per_min:maxReqMin,max_requests_per_hour:maxReqHour,max_tokens_per_day:maxTokDay}},cors,201);
      }

      const rateLimitMatch = p.match(/^\/api\/rate-limits\/([^/]+)$/);
      if (rateLimitMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_rate_limits WHERE id=?').bind(rateLimitMatch[1]).run();
        return json({ok:true,deleted:rateLimitMatch[1]},cors);
      }

      // Check rate limit for a user (before making a request)
      const rateLimitCheckMatch = p.match(/^\/api\/rate-limits\/check\/([^/]+)$/);
      if (rateLimitCheckMatch && request.method === 'GET') {
        const userId = rateLimitCheckMatch[1];
        const provider = url.searchParams.get('provider') || '*';

        const limits = await env.DB.prepare('SELECT * FROM cp_rate_limits WHERE user_id=? AND (provider=? OR provider=\'*\') ORDER BY provider DESC LIMIT 1')
          .bind(userId, provider).first();

        if (!limits) return json({allowed:true,reason:'no rate limit configured',user_id:userId},cors);

        // Reset counters if time windows have passed
        const now = new Date();
        const lastMin = new Date(limits.last_reset_min + 'Z');
        const lastHour = new Date(limits.last_reset_hour + 'Z');
        const lastDay = new Date(limits.last_reset_day + 'Z');

        let reqMin = limits.current_requests_min;
        let reqHour = limits.current_requests_hour;
        let tokDay = limits.current_tokens_day;

        if (now - lastMin > 60000) { reqMin = 0; }
        if (now - lastHour > 3600000) { reqHour = 0; }
        if (now - lastDay > 86400000) { tokDay = 0; }

        const allowed = reqMin < limits.max_requests_per_min &&
                        reqHour < limits.max_requests_per_hour &&
                        tokDay < limits.max_tokens_per_day;

        const reasons = [];
        if (reqMin >= limits.max_requests_per_min) reasons.push(`minute limit reached (${reqMin}/${limits.max_requests_per_min})`);
        if (reqHour >= limits.max_requests_per_hour) reasons.push(`hour limit reached (${reqHour}/${limits.max_requests_per_hour})`);
        if (tokDay >= limits.max_tokens_per_day) reasons.push(`daily token limit reached (${tokDay}/${limits.max_tokens_per_day})`);

        return json({
          allowed,
          user_id: userId,
          provider,
          current: {requests_this_min:reqMin,requests_this_hour:reqHour,tokens_today:tokDay},
          limits: {max_requests_per_min:limits.max_requests_per_min,max_requests_per_hour:limits.max_requests_per_hour,max_tokens_per_day:limits.max_tokens_per_day},
          reasons: reasons.length ? reasons : undefined,
          usage_pct: {
            minute: Math.round((reqMin / limits.max_requests_per_min) * 100),
            hour: Math.round((reqHour / limits.max_requests_per_hour) * 100),
            daily_tokens: Math.round((tokDay / limits.max_tokens_per_day) * 100),
          },
        },cors);
      }

      // Increment rate limit counters (call after each request)
      const rateLimitIncrMatch = p.match(/^\/api\/rate-limits\/increment\/([^/]+)$/);
      if (rateLimitIncrMatch && request.method === 'POST') {
        const body = await request.json();
        const userId = rateLimitIncrMatch[1];
        const provider = body.provider || '*';
        const tokens = parseInt(body.tokens) || 0;

        const limits = await env.DB.prepare('SELECT * FROM cp_rate_limits WHERE user_id=? AND (provider=? OR provider=\'*\') ORDER BY provider DESC LIMIT 1')
          .bind(userId, provider).first();
        if (!limits) return json({ok:true,no_limits:true},cors);

        const now = new Date().toISOString().replace('T',' ').slice(0,19);
        const lastMin = new Date(limits.last_reset_min + 'Z');
        const lastHour = new Date(limits.last_reset_hour + 'Z');
        const lastDay = new Date(limits.last_reset_day + 'Z');
        const nowDate = new Date();

        let reqMin = (nowDate - lastMin > 60000) ? 1 : limits.current_requests_min + 1;
        let reqHour = (nowDate - lastHour > 3600000) ? 1 : limits.current_requests_hour + 1;
        let tokDay = (nowDate - lastDay > 86400000) ? tokens : limits.current_tokens_day + tokens;

        await env.DB.prepare("UPDATE cp_rate_limits SET current_requests_min=?,current_requests_hour=?,current_tokens_day=?,last_reset_min=?,last_reset_hour=?,last_reset_day=?,updated_at=datetime('now') WHERE id=?")
          .bind(reqMin, reqHour, tokDay,
            (nowDate - lastMin > 60000) ? now : limits.last_reset_min,
            (nowDate - lastHour > 3600000) ? now : limits.last_reset_hour,
            (nowDate - lastDay > 86400000) ? now : limits.last_reset_day,
            limits.id).run();

        return json({ok:true,current:{requests_this_min:reqMin,requests_this_hour:reqHour,tokens_today:tokDay}},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 13: Embedding Store (/api/embeddings)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/embeddings' && request.method === 'GET') {
        const collection = url.searchParams.get('collection') || 'default';
        const count = await env.DB.prepare('SELECT COUNT(*) as c FROM cp_embeddings WHERE collection=?').bind(collection).first();
        const collections = await env.DB.prepare('SELECT collection, COUNT(*) as count FROM cp_embeddings GROUP BY collection ORDER BY count DESC').all();
        return json({collection,count:count?.c||0,all_collections:collections.results||[]},cors);
      }

      if (p === '/api/embeddings' && request.method === 'POST') {
        const body = await request.json();
        if (!body.content) return json({error:'content required'},cors,400);
        const collection = (body.collection || 'default').slice(0,50);
        const id = crypto.randomUUID().slice(0,8);

        // Generate a simple embedding using character frequencies + word hashing
        // (In production, you'd use a proper embedding model like @cf/baai/bge-base-en-v1.5)
        const text = body.content.slice(0,5000).toLowerCase();
        const vector = generateSimpleEmbedding(text);

        await env.DB.prepare('INSERT INTO cp_embeddings (id,content,metadata,collection,vector) VALUES (?,?,?,?,?)')
          .bind(id, body.content.slice(0,5000), JSON.stringify(body.metadata||{}), collection, JSON.stringify(vector)).run();

        stampChain('embedding_store', collection, body.content.slice(0,50));
        return json({ok:true,id,collection,dimensions:vector.length},cors,201);
      }

      // Batch store embeddings
      if (p === '/api/embeddings/batch' && request.method === 'POST') {
        const body = await request.json();
        if (!body.items || !Array.isArray(body.items)) return json({error:'items array required'},cors,400);
        if (body.items.length > 100) return json({error:'max 100 items per batch'},cors,400);
        const collection = (body.collection || 'default').slice(0,50);

        let stored = 0;
        for (const item of body.items) {
          if (!item.content) continue;
          const id = crypto.randomUUID().slice(0,8);
          const text = item.content.slice(0,5000).toLowerCase();
          const vector = generateSimpleEmbedding(text);
          await env.DB.prepare('INSERT INTO cp_embeddings (id,content,metadata,collection,vector) VALUES (?,?,?,?,?)')
            .bind(id, item.content.slice(0,5000), JSON.stringify(item.metadata||{}), collection, JSON.stringify(vector)).run();
          stored++;
        }

        return json({ok:true,stored,collection},cors,201);
      }

      // Search embeddings (semantic similarity)
      if (p === '/api/embeddings/search' && request.method === 'POST') {
        const body = await request.json();
        if (!body.query) return json({error:'query required'},cors,400);
        const collection = body.collection || 'default';
        const topK = Math.max(1, Math.min(50, parseInt(body.top_k)||10));

        const queryVector = generateSimpleEmbedding(body.query.slice(0,2000).toLowerCase());

        // Load all embeddings from collection and compute cosine similarity
        const allEmbeddings = await env.DB.prepare('SELECT id,content,metadata,vector FROM cp_embeddings WHERE collection=?').bind(collection).all();

        const results = (allEmbeddings.results||[]).map(emb => {
          const embVector = JSON.parse(emb.vector||'[]');
          const similarity = cosineSimilarity(queryVector, embVector);
          return {
            id: emb.id,
            content: emb.content,
            metadata: JSON.parse(emb.metadata||'{}'),
            similarity: Math.round(similarity * 10000) / 10000,
          };
        }).sort((a,b) => b.similarity - a.similarity).slice(0, topK);

        return json({query:body.query,collection,results,count:results.length},cors);
      }

      // Delete embeddings
      const embeddingMatch = p.match(/^\/api\/embeddings\/([^/]+)$/);
      if (embeddingMatch && request.method === 'DELETE') {
        // Delete by ID or collection
        const target = embeddingMatch[1];
        if (target.length <= 8) {
          await env.DB.prepare('DELETE FROM cp_embeddings WHERE id=?').bind(target).run();
        } else {
          await env.DB.prepare('DELETE FROM cp_embeddings WHERE collection=?').bind(target).run();
        }
        return json({ok:true,deleted:target},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 14: Tool Registry (/api/tools)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/tools' && request.method === 'GET') {
        const active = url.searchParams.get('active');
        let query = 'SELECT id,name,description,parameters,endpoint,auth_type,active,uses,created_at FROM cp_tools';
        if (active === '1' || active === 'true') query += ' WHERE active=1';
        query += ' ORDER BY uses DESC, created_at DESC LIMIT 50';
        const rows = await env.DB.prepare(query).all();
        return json({tools:(rows.results||[]).map(t=>({...t,parameters:JSON.parse(t.parameters||'{}')}))},cors);
      }

      if (p === '/api/tools' && request.method === 'POST') {
        const body = await request.json();
        if (!body.name || !body.description) return json({error:'name and description required'},cors,400);
        const id = crypto.randomUUID().slice(0,8);
        const authTypes = ['none','bearer','api_key','basic'];
        const authType = authTypes.includes(body.auth_type) ? body.auth_type : 'none';

        // Validate parameters schema
        const params = body.parameters || {};
        if (typeof params !== 'object') return json({error:'parameters must be a JSON object describing input schema'},cors,400);

        await env.DB.prepare('INSERT INTO cp_tools (id,name,description,parameters,endpoint,auth_type,auth_config) VALUES (?,?,?,?,?,?,?)')
          .bind(id, body.name.slice(0,100), body.description.slice(0,500), JSON.stringify(params), (body.endpoint||'').slice(0,500), authType, JSON.stringify(body.auth_config||{})).run();

        stampChain('tool_register', body.name.slice(0,50), authType);
        return json({ok:true,id,name:body.name,auth_type:authType},cors,201);
      }

      const toolMatch = p.match(/^\/api\/tools\/([^/]+)$/);
      if (toolMatch && request.method === 'GET') {
        const tool = await env.DB.prepare('SELECT * FROM cp_tools WHERE id=? OR name=?').bind(toolMatch[1], toolMatch[1]).first();
        if (!tool) return json({error:'tool not found'},cors,404);
        return json({tool:{...tool,parameters:JSON.parse(tool.parameters||'{}'),auth_config:JSON.parse(tool.auth_config||'{}')}},cors);
      }

      if (toolMatch && request.method === 'PUT') {
        const body = await request.json();
        const tool = await env.DB.prepare('SELECT * FROM cp_tools WHERE id=?').bind(toolMatch[1]).first();
        if (!tool) return json({error:'tool not found'},cors,404);
        const active = body.active !== undefined ? (body.active ? 1 : 0) : tool.active;
        const desc = (body.description || tool.description).slice(0,500);
        const endpoint = (body.endpoint !== undefined ? body.endpoint : tool.endpoint || '').slice(0,500);
        const params = body.parameters ? JSON.stringify(body.parameters) : tool.parameters;

        await env.DB.prepare("UPDATE cp_tools SET description=?,parameters=?,endpoint=?,active=?,updated_at=datetime('now') WHERE id=?")
          .bind(desc, params, endpoint, active, toolMatch[1]).run();
        return json({ok:true,id:toolMatch[1],active:!!active},cors);
      }

      if (toolMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_tools WHERE id=?').bind(toolMatch[1]).run();
        return json({ok:true,deleted:toolMatch[1]},cors);
      }

      // Execute a tool
      const toolExecMatch = p.match(/^\/api\/tools\/([^/]+)\/execute$/);
      if (toolExecMatch && request.method === 'POST') {
        const body = await request.json();
        const tool = await env.DB.prepare('SELECT * FROM cp_tools WHERE (id=? OR name=?) AND active=1').bind(toolExecMatch[1], toolExecMatch[1]).first();
        if (!tool) return json({error:'tool not found or inactive'},cors,404);

        const start = Date.now();
        let output = null;
        let status = 'success';

        if (tool.endpoint) {
          // Execute via HTTP endpoint
          try {
            const authConfig = JSON.parse(tool.auth_config||'{}');
            const headers = {'Content-Type':'application/json'};
            if (tool.auth_type === 'bearer') headers['Authorization'] = `Bearer ${authConfig.token || body.auth_token || ''}`;
            else if (tool.auth_type === 'api_key') headers[authConfig.header || 'X-API-Key'] = authConfig.key || body.auth_key || '';

            const resp = await fetch(tool.endpoint, {
              method: 'POST',
              headers,
              body: JSON.stringify(body.input || {}),
              signal: AbortSignal.timeout(15000),
            });
            output = await resp.json().catch(async () => ({text: await resp.text()}));
          } catch(e) {
            output = {error: e.message};
            status = 'error';
          }
        } else {
          // No endpoint — simulate tool execution locally
          output = {
            tool: tool.name,
            input: body.input || {},
            simulated: true,
            message: `Tool "${tool.name}" executed with provided input. No endpoint configured for live execution.`,
          };
        }

        const duration = Date.now() - start;
        const execId = crypto.randomUUID().slice(0,8);

        await env.DB.prepare('INSERT INTO cp_tool_executions (id,tool_id,input,output,status,duration_ms) VALUES (?,?,?,?,?,?)')
          .bind(execId, tool.id, JSON.stringify(body.input||{}), JSON.stringify(output), status, duration).run();
        await env.DB.prepare("UPDATE cp_tools SET uses=uses+1,updated_at=datetime('now') WHERE id=?").bind(tool.id).run();

        stampChain('tool_execute', tool.name, status);
        return json({ok:true,execution_id:execId,tool:tool.name,status,output,duration_ms:duration},cors);
      }

      // Tool execution history
      const toolHistoryMatch = p.match(/^\/api\/tools\/([^/]+)\/history$/);
      if (toolHistoryMatch && request.method === 'GET') {
        const tool = await env.DB.prepare('SELECT id FROM cp_tools WHERE id=? OR name=?').bind(toolHistoryMatch[1], toolHistoryMatch[1]).first();
        if (!tool) return json({error:'tool not found'},cors,404);
        const rows = await env.DB.prepare('SELECT id,status,duration_ms,created_at FROM cp_tool_executions WHERE tool_id=? ORDER BY created_at DESC LIMIT 50').bind(tool.id).all();
        return json({tool_id:tool.id,executions:rows.results||[]},cors);
      }

      // Get tools formatted for function calling (OpenAI-compatible format)
      if (p === '/api/tools/schema/openai' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT name,description,parameters FROM cp_tools WHERE active=1 ORDER BY name').all();
        const functions = (rows.results||[]).map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: JSON.parse(t.parameters||'{}'),
          },
        }));
        return json({tools:functions,count:functions.length},cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // NEW FEATURE 15: AI Playground (/api/playground)
      // ═══════════════════════════════════════════════════════════════
      if (p === '/api/playground' && request.method === 'GET') {
        const rows = await env.DB.prepare('SELECT id,name,provider,model,temperature,top_p,max_tokens,total_tokens,created_at,updated_at FROM cp_playground_sessions ORDER BY updated_at DESC LIMIT 30').all();
        return json({sessions: rows.results||[]},cors);
      }

      if (p === '/api/playground' && request.method === 'POST') {
        const body = await request.json();
        const id = crypto.randomUUID().slice(0,8);
        const provider = body.provider || 'fleet';
        const model = body.model || (PROVIDER_CONFIG[provider]||PROVIDER_CONFIG.fleet).model;
        const temp = Math.max(0, Math.min(2, parseFloat(body.temperature)||0.7));
        const topP = Math.max(0, Math.min(1, parseFloat(body.top_p)||1.0));
        const maxTok = Math.max(50, Math.min(4000, parseInt(body.max_tokens)||600));
        const freqPen = Math.max(-2, Math.min(2, parseFloat(body.frequency_penalty)||0));
        const presPen = Math.max(-2, Math.min(2, parseFloat(body.presence_penalty)||0));

        await env.DB.prepare('INSERT INTO cp_playground_sessions (id,name,provider,model,system_prompt,temperature,top_p,max_tokens,frequency_penalty,presence_penalty) VALUES (?,?,?,?,?,?,?,?,?,?)')
          .bind(id, (body.name||'Playground Session').slice(0,100), provider, model, (body.system_prompt||'').slice(0,2000), temp, topP, maxTok, freqPen, presPen).run();

        return json({ok:true,id,provider,model,temperature:temp,top_p:topP,max_tokens:maxTok},cors,201);
      }

      const playgroundMatch = p.match(/^\/api\/playground\/([^/]+)$/);
      if (playgroundMatch && request.method === 'GET') {
        const session = await env.DB.prepare('SELECT * FROM cp_playground_sessions WHERE id=?').bind(playgroundMatch[1]).first();
        if (!session) return json({error:'playground session not found'},cors,404);
        return json({session:{...session,history:JSON.parse(session.history||'[]')}},cors);
      }

      if (playgroundMatch && request.method === 'PUT') {
        const body = await request.json();
        const session = await env.DB.prepare('SELECT * FROM cp_playground_sessions WHERE id=?').bind(playgroundMatch[1]).first();
        if (!session) return json({error:'playground session not found'},cors,404);

        const temp = body.temperature !== undefined ? Math.max(0, Math.min(2, parseFloat(body.temperature))) : session.temperature;
        const topP = body.top_p !== undefined ? Math.max(0, Math.min(1, parseFloat(body.top_p))) : session.top_p;
        const maxTok = body.max_tokens !== undefined ? Math.max(50, Math.min(4000, parseInt(body.max_tokens))) : session.max_tokens;
        const freqPen = body.frequency_penalty !== undefined ? Math.max(-2, Math.min(2, parseFloat(body.frequency_penalty))) : session.frequency_penalty;
        const presPen = body.presence_penalty !== undefined ? Math.max(-2, Math.min(2, parseFloat(body.presence_penalty))) : session.presence_penalty;
        const sysProm = body.system_prompt !== undefined ? body.system_prompt.slice(0,2000) : session.system_prompt;
        const provider = body.provider || session.provider;
        const model = body.model || session.model;

        await env.DB.prepare("UPDATE cp_playground_sessions SET provider=?,model=?,system_prompt=?,temperature=?,top_p=?,max_tokens=?,frequency_penalty=?,presence_penalty=?,updated_at=datetime('now') WHERE id=?")
          .bind(provider, model, sysProm, temp, topP, maxTok, freqPen, presPen, playgroundMatch[1]).run();

        return json({ok:true,id:playgroundMatch[1],temperature:temp,top_p:topP,max_tokens:maxTok},cors);
      }

      if (playgroundMatch && request.method === 'DELETE') {
        await env.DB.prepare('DELETE FROM cp_playground_sessions WHERE id=?').bind(playgroundMatch[1]).run();
        return json({ok:true,deleted:playgroundMatch[1]},cors);
      }

      // Send a message in the playground
      const playgroundChatMatch = p.match(/^\/api\/playground\/([^/]+)\/chat$/);
      if (playgroundChatMatch && request.method === 'POST') {
        const body = await request.json();
        if (!body.message) return json({error:'message required'},cors,400);

        const session = await env.DB.prepare('SELECT * FROM cp_playground_sessions WHERE id=?').bind(playgroundChatMatch[1]).first();
        if (!session) return json({error:'playground session not found'},cors,404);

        const history = JSON.parse(session.history||'[]');
        const messages = [];

        // System prompt
        if (session.system_prompt) {
          messages.push({role:'system',content:session.system_prompt});
        }

        // Include history (last 20 messages for context)
        const recentHistory = history.slice(-20);
        messages.push(...recentHistory);

        // Add new user message
        messages.push({role:'user',content:body.message.slice(0,4000)});

        const provider = body.provider || session.provider;
        const result = await callProvider(env, provider, messages, body.api_key, session.max_tokens);

        // Update history
        history.push({role:'user',content:body.message.slice(0,4000)});
        history.push({role:'assistant',content:result.response});

        // Keep history manageable
        const trimmedHistory = history.slice(-100);
        const totalTokens = (session.total_tokens||0) + (result.tokens_estimated||0);

        await env.DB.prepare("UPDATE cp_playground_sessions SET history=?,total_tokens=?,updated_at=datetime('now') WHERE id=?")
          .bind(JSON.stringify(trimmedHistory), totalTokens, playgroundChatMatch[1]).run();

        await trackUsage(env, provider, result.model, 'playground', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'playground', body.user_id || 'system');

        return json({
          ok:true,
          response:result.response,
          provider:result.provider,
          model:result.model,
          duration_ms:result.duration_ms,
          tokens_estimated:result.tokens_estimated,
          session_params:{temperature:session.temperature,top_p:session.top_p,max_tokens:session.max_tokens,frequency_penalty:session.frequency_penalty,presence_penalty:session.presence_penalty},
          history_length:trimmedHistory.length,
          total_tokens:totalTokens,
        },cors);
      }

      // Quick playground (no session — one-shot with params)
      if (p === '/api/playground/quick' && request.method === 'POST') {
        const body = await request.json();
        if (!body.message && !body.prompt) return json({error:'message or prompt required'},cors,400);
        const message = body.message || body.prompt;
        const provider = body.provider || 'fleet';
        const maxTok = Math.max(50, Math.min(4000, parseInt(body.max_tokens)||600));

        const messages = [];
        if (body.system_prompt) messages.push({role:'system',content:body.system_prompt.slice(0,2000)});
        messages.push({role:'user',content:message.slice(0,4000)});

        const result = await callProvider(env, provider, messages, body.api_key, maxTok);

        await trackUsage(env, provider, result.model, 'playground_quick', body.user_id || 'system', result.tokens_estimated, result.duration_ms);
        await trackCost(env, provider, result.model, result.tokens_estimated, 'playground_quick', body.user_id || 'system');

        return json({
          ok:true,
          response:result.response,
          provider:result.provider,
          model:result.model,
          duration_ms:result.duration_ms,
          tokens_estimated:result.tokens_estimated,
          params:{temperature:parseFloat(body.temperature)||0.7,top_p:parseFloat(body.top_p)||1.0,max_tokens:maxTok},
        },cors);
      }

      // ═══════════════════════════════════════════════════════════════
      // CATCH-ALL
      // ═══════════════════════════════════════════════════════════════
      if (p.startsWith('/api/')) return json({error:'not found'},cors,404);
      return new Response(HTML, {headers:{'Content-Type':'text/html;charset=utf-8',...cors}});

    } catch(e) { return json({error:e.message},cors,500); }
  }
};

// ─── Helpers ───

function json(d,cors,s=200){return new Response(JSON.stringify(d),{status:s,headers:{...cors,'Content-Type':'application/json'}})}

async function trackUsage(env, provider, model, operation, userId, tokens, durationMs) {
  try {
    await env.DB.prepare('INSERT INTO cp_usage (id,provider,model,operation,user_id,tokens,duration_ms) VALUES (?,?,?,?,?,?,?)')
      .bind(crypto.randomUUID().slice(0,8), provider, model||'', operation, userId||'system', tokens||0, durationMs||0).run();
  } catch(e) { /* non-critical */ }
}

// Simple embedding generator (character frequency + word hash based, 64 dimensions)
function generateSimpleEmbedding(text) {
  const dim = 64;
  const vector = new Array(dim).fill(0);

  // Character frequency features (first 26 dims = letter frequencies)
  const total = Math.max(text.length, 1);
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c >= 97 && c <= 122) vector[c - 97] += 1 / total;
  }

  // Word-level features (dims 26-63)
  const words = text.split(/\s+/).filter(w => w.length > 0);
  for (const word of words) {
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = ((hash << 5) - hash + word.charCodeAt(i)) | 0;
    }
    const idx = 26 + (Math.abs(hash) % (dim - 26));
    vector[idx] += 1 / Math.max(words.length, 1);
  }

  // Normalize to unit vector
  const mag = Math.sqrt(vector.reduce((s, v) => s + v * v, 0)) || 1;
  return vector.map(v => Math.round((v / mag) * 10000) / 10000);
}

// Cosine similarity between two vectors
function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

async function trackCost(env, provider, model, tokens, operation, userId) {
  try {
    const costPer1k = COST_PER_1K[provider] || 0;
    const cost = (tokens / 1000) * costPer1k;
    if (cost > 0 || tokens > 0) {
      await env.DB.prepare('INSERT INTO cp_costs (id,provider,model,tokens_used,estimated_cost,operation,user_id) VALUES (?,?,?,?,?,?,?)')
        .bind(crypto.randomUUID().slice(0,8), provider, model||'', tokens, cost, operation, userId||'system').run();
    }
  } catch(e) { /* non-critical */ }
}

const HTML = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>CarPool — Your AIs, Riding Together | BlackRoad OS</title>
<meta name="description" content="AI-to-AI integration hub. Connect ChatGPT, Claude, Gemini and watch them collaborate. Compare, cache, batch, and track costs.">
<link rel="canonical" href="https://carpool.blackroad.io">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--g:linear-gradient(90deg,#FF6B2B,#FF2255,#CC00AA,#8844FF,#4488FF,#00D4FF);--bg:#000;--card:#0a0a0a;--elevated:#111;--border:#1a1a1a;--muted:#444;--sub:#737373;--text:#f5f5f5;--white:#fff;--sg:'Space Grotesk',sans-serif;--jb:'JetBrains Mono',monospace}
body{background:var(--bg);color:var(--text);font-family:var(--sg);line-height:1.6;min-height:100vh;padding:0}
.grad-bar{height:3px;background:var(--g)}
.wrap{max-width:720px;margin:0 auto;padding:32px 24px}
h1{font-size:32px;font-weight:700;color:var(--white);margin-bottom:8px}
h2{font-size:18px;font-weight:600;color:var(--white);margin-bottom:6px}
.sub{color:var(--sub);font-size:14px;margin-bottom:32px}
.card{background:var(--card);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;overflow:hidden}
.card-grad{height:3px;background:var(--g)}
.card-body{padding:20px}
.card-title{font-weight:600;font-size:15px;color:var(--white);margin-bottom:6px}
.card-text{font-size:13px;color:var(--sub);line-height:1.7}
.input{width:100%;padding:10px 14px;background:var(--card);border:1px solid var(--border);border-radius:6px;color:var(--text);font-size:13px;outline:none;font-family:var(--sg);margin-bottom:8px}
.input:focus{border-color:#333}
.input::placeholder{color:var(--muted)}
textarea.input{min-height:60px;resize:vertical}
select.input{appearance:auto}
.btn{padding:10px 22px;border-radius:6px;font-weight:600;font-size:13px;border:none;cursor:pointer;font-family:var(--sg);transition:all .15s;margin-right:6px;margin-bottom:6px}
.btn-white{background:var(--white);color:#000}
.btn-white:hover{background:#e0e0e0}
.btn-outline{background:transparent;border:1px solid var(--border);color:var(--text)}
.btn-outline:hover{border-color:#333}
.btn-sm{padding:6px 14px;font-size:11px}
.badge{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:4px;font-size:11px;font-weight:600;background:var(--elevated);border:1px solid var(--border);color:var(--text)}
.badge-dot{width:5px;height:5px;border-radius:50%}
.badge-green .badge-dot{background:#22c55e}
.badge-yellow .badge-dot{background:#eab308}
.badge-red .badge-dot{background:#ef4444}
.badge-white .badge-dot{background:var(--white)}
.response{background:var(--elevated);border:1px solid var(--border);border-radius:8px;padding:14px;margin-top:8px;font-size:13px;color:var(--text);line-height:1.6}
.provider-name{font-family:var(--jb);font-size:11px;color:var(--muted);margin-bottom:4px}
.footer{font-family:var(--jb);font-size:10px;color:var(--muted);text-align:center;margin-top:40px}
.footer a{color:var(--sub)}
.tabs{display:flex;gap:0;margin-bottom:24px;border-bottom:1px solid var(--border);overflow-x:auto}
.tab{padding:10px 16px;font-size:12px;font-weight:600;color:var(--sub);cursor:pointer;border-bottom:2px solid transparent;white-space:nowrap;transition:all .15s}
.tab:hover{color:var(--text)}
.tab.active{color:var(--white);border-bottom-color:var(--white)}
.tab-panel{display:none}
.tab-panel.active{display:block}
.grid-2{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.stat-box{background:var(--elevated);border:1px solid var(--border);border-radius:8px;padding:12px;text-align:center}
.stat-val{font-size:24px;font-weight:700;color:var(--white)}
.stat-label{font-size:11px;color:var(--sub);margin-top:2px}
.health-row{display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)}
.health-row:last-child{border-bottom:none}
.comparison-card{border-left:3px solid;padding-left:12px;margin-bottom:12px}
.score-bar{height:4px;border-radius:2px;background:var(--border);margin-top:4px;overflow:hidden}
.score-fill{height:100%;border-radius:2px;background:var(--g)}
.mono{font-family:var(--jb);font-size:11px}
#results{display:none}
@media(max-width:600px){.grid-2{grid-template-columns:1fr}.tabs{flex-wrap:wrap}}
</style>
<meta property="og:title" content="CarPool — BlackRoad OS">
<meta property="og:description" content="AI-to-AI integration hub. Compare, cache, batch process, and track costs across providers.">
<meta property="og:url" content="https://carpool.blackroad.io">
<meta property="og:image" content="https://images.blackroad.io/pixel-art/road-logo.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow, noai, noimageai">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebApplication","name":"CarPool","url":"https://carpool.blackroad.io","author":{"@type":"Organization","name":"BlackRoad OS, Inc.","url":"https://blackroad.io"},"applicationCategory":"DeveloperApplication","description":"AI-to-AI integration hub with model comparison, prompt library, cost tracking, fallback chains, response caching, batch processing, usage analytics, fine-tuning, conversation memory, agent personas, evaluation suites, rate limiting, embedding store, tool registry, and AI playground."}</script>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%230a0a0a'/><circle cx='10' cy='16' r='5' fill='%23FF2255'/><rect x='18' y='11' width='10' height='10' rx='2' fill='%238844FF'/></svg>" type="image/svg+xml">
</head><body>
<div class="grad-bar"></div>
<div class="wrap">
<div style="width:80px;height:3px;border-radius:2px;background:var(--g);margin-bottom:20px"></div>
<h1>CarPool</h1>
<p class="sub">Your AIs, riding together. Compare models, cache responses, track costs, and orchestrate AI workflows.</p>

<div class="tabs" id="main-tabs">
  <div class="tab active" data-tab="convoy">Convoy</div>
  <div class="tab" data-tab="compare">Compare</div>
  <div class="tab" data-tab="prompts">Prompts</div>
  <div class="tab" data-tab="batch">Batch</div>
  <div class="tab" data-tab="cache">Cache</div>
  <div class="tab" data-tab="fallback">Fallback</div>
  <div class="tab" data-tab="costs">Costs</div>
  <div class="tab" data-tab="health">Health</div>
  <div class="tab" data-tab="usage">Usage</div>
  <div class="tab" data-tab="finetune">Fine-tune</div>
  <div class="tab" data-tab="threads">Threads</div>
  <div class="tab" data-tab="personas">Personas</div>
  <div class="tab" data-tab="eval">Eval</div>
  <div class="tab" data-tab="ratelimits">Limits</div>
  <div class="tab" data-tab="embeddings">Embeddings</div>
  <div class="tab" data-tab="tools">Tools</div>
  <div class="tab" data-tab="playground">Playground</div>
</div>

<!-- CONVOY TAB -->
<div class="tab-panel active" id="panel-convoy">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Ask the Convoy</div>
<div class="card-text" style="margin-bottom:12px">One question, multiple AI perspectives. See how different models think.</div>
<input class="input" id="question" placeholder="Ask anything..." autofocus>
<button class="btn btn-white" onclick="askConvoy()">Ask All AIs</button>
</div></div>
<div id="results"></div>

<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Hand Off</div>
<div class="card-text" style="margin-bottom:12px">Pass context from one AI to another. Like a relay race.</div>
<input class="input" id="ho-from" placeholder="From (e.g. claude)">
<input class="input" id="ho-to" placeholder="To (e.g. fleet)">
<input class="input" id="ho-msg" placeholder="Message to hand off...">
<button class="btn btn-outline" onclick="handoff()">Hand Off</button>
<div id="ho-result"></div>
</div></div>

<div class="card"><div class="card-body" style="text-align:center">
<span class="badge badge-white"><span class="badge-dot"></span><span id="stat-providers">1</span> providers</span>
<span class="badge badge-white" style="margin-left:8px"><span class="badge-dot"></span><span id="stat-handoffs">0</span> handoffs</span>
<span class="badge badge-white" style="margin-left:8px"><span class="badge-dot"></span><span id="stat-memory">0</span> shared memories</span>
<span class="badge badge-white" style="margin-left:8px"><span class="badge-dot"></span><span id="stat-prompts">0</span> prompts</span>
<span class="badge badge-white" style="margin-left:8px"><span class="badge-dot"></span><span id="stat-cache">0</span> cached</span>
</div></div>
</div>

<!-- COMPARE TAB -->
<div class="tab-panel" id="panel-compare">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Model Comparison</div>
<div class="card-text" style="margin-bottom:12px">Send the same prompt to multiple providers. See side-by-side results with latency and quality scores.</div>
<textarea class="input" id="compare-prompt" placeholder="Enter your prompt..."></textarea>
<div style="margin-bottom:8px">
  <label style="font-size:12px;color:var(--sub)">Select providers:</label>
  <div id="compare-providers" style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px">
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="fleet" checked style="margin-right:4px"> Fleet</label>
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="openai" style="margin-right:4px"> OpenAI</label>
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="anthropic" style="margin-right:4px"> Anthropic</label>
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="gemini" style="margin-right:4px"> Gemini</label>
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="grok" style="margin-right:4px"> Grok</label>
    <label class="badge" style="cursor:pointer"><input type="checkbox" value="deepseek" style="margin-right:4px"> DeepSeek</label>
  </div>
</div>
<button class="btn btn-white" onclick="runCompare()">Compare Models</button>
</div></div>
<div id="compare-results"></div>
</div>

<!-- PROMPTS TAB -->
<div class="tab-panel" id="panel-prompts">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Prompt Library</div>
<div class="card-text" style="margin-bottom:12px">Save, search, and share reusable prompts. Rate effectiveness.</div>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input class="input" id="prompt-search" placeholder="Search prompts..." style="margin-bottom:0;flex:1">
  <button class="btn btn-outline btn-sm" onclick="searchPrompts()">Search</button>
</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Add new prompt</summary>
  <div style="margin-top:8px">
    <input class="input" id="prompt-title" placeholder="Prompt title">
    <select class="input" id="prompt-category">
      <option value="general">General</option><option value="coding">Coding</option>
      <option value="writing">Writing</option><option value="analysis">Analysis</option>
      <option value="creative">Creative</option><option value="business">Business</option>
      <option value="research">Research</option><option value="system">System</option>
    </select>
    <textarea class="input" id="prompt-text" placeholder="Prompt text..."></textarea>
    <input class="input" id="prompt-tags" placeholder="Tags (comma-separated)">
    <button class="btn btn-white btn-sm" onclick="savePrompt()">Save Prompt</button>
  </div>
</details>
</div></div>
<div id="prompts-list"></div>
</div>

<!-- BATCH TAB -->
<div class="tab-panel" id="panel-batch">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Batch Processing</div>
<div class="card-text" style="margin-bottom:12px">Submit multiple prompts at once. Up to 20 processed in parallel.</div>
<textarea class="input" id="batch-prompts" placeholder="One prompt per line..." style="min-height:120px"></textarea>
<select class="input" id="batch-provider" style="width:auto;display:inline-block">
  <option value="fleet">Fleet</option><option value="openai">OpenAI</option>
  <option value="anthropic">Anthropic</option><option value="gemini">Gemini</option>
</select>
<button class="btn btn-white" onclick="runBatch()">Process Batch</button>
</div></div>
<div id="batch-results"></div>
</div>

<!-- CACHE TAB -->
<div class="tab-panel" id="panel-cache">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Response Cache</div>
<div class="card-text" style="margin-bottom:12px">Cache identical prompts to save tokens. Configurable TTL.</div>
<div class="grid-2" id="cache-stats" style="margin-bottom:12px">
  <div class="stat-box"><div class="stat-val" id="cache-entries">-</div><div class="stat-label">Cached Entries</div></div>
  <div class="stat-box"><div class="stat-val" id="cache-hits">-</div><div class="stat-label">Total Hits</div></div>
  <div class="stat-box"><div class="stat-val" id="cache-rate">-</div><div class="stat-label">Hit Rate</div></div>
  <div class="stat-box"><div class="stat-val" id="cache-expired">-</div><div class="stat-label">Expired</div></div>
</div>
<textarea class="input" id="cache-prompt" placeholder="Query with cache..."></textarea>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
  <select class="input" id="cache-provider" style="width:auto;margin-bottom:0">
    <option value="fleet">Fleet</option><option value="openai">OpenAI</option>
    <option value="anthropic">Anthropic</option>
  </select>
  <input class="input" id="cache-ttl" type="number" value="3600" min="60" max="86400" style="width:100px;margin-bottom:0" placeholder="TTL (s)">
</div>
<button class="btn btn-white btn-sm" onclick="cacheQuery()">Query (with cache)</button>
<button class="btn btn-outline btn-sm" onclick="clearCache(false)">Clear All</button>
<button class="btn btn-outline btn-sm" onclick="clearCache(true)">Clear Expired</button>
</div></div>
<div id="cache-result"></div>
</div>

<!-- FALLBACK TAB -->
<div class="tab-panel" id="panel-fallback">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Fallback Chains</div>
<div class="card-text" style="margin-bottom:12px">Define ordered sequences: try Claude, then GPT, then Ollama. Auto-switch on failure.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Create new chain</summary>
  <div style="margin-top:8px">
    <input class="input" id="fb-name" placeholder="Chain name (e.g. premium-fallback)">
    <input class="input" id="fb-chain" placeholder="Provider order (comma-separated: anthropic,openai,fleet)">
    <input class="input" id="fb-desc" placeholder="Description (optional)">
    <button class="btn btn-white btn-sm" onclick="createChain()">Create Chain</button>
  </div>
</details>
<div id="fb-chains"></div>
<div style="margin-top:12px;border-top:1px solid var(--border);padding-top:12px">
  <div style="font-size:12px;color:var(--sub);margin-bottom:8px">Test a chain:</div>
  <input class="input" id="fb-test-chain" placeholder="Chain ID or name">
  <input class="input" id="fb-test-prompt" placeholder="Prompt to test...">
  <button class="btn btn-outline btn-sm" onclick="testChain()">Execute Chain</button>
</div>
</div></div>
<div id="fb-result"></div>
</div>

<!-- COSTS TAB -->
<div class="tab-panel" id="panel-costs">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Cost Tracker</div>
<div class="card-text" style="margin-bottom:12px">Track token usage and estimated cost per provider. Set budget alerts.</div>
<div class="grid-2" id="cost-overview" style="margin-bottom:12px">
  <div class="stat-box"><div class="stat-val" id="cost-total">$0</div><div class="stat-label">Total Cost (30d)</div></div>
  <div class="stat-box"><div class="stat-val" id="cost-tokens">0</div><div class="stat-label">Total Tokens</div></div>
</div>
<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px">
  <select class="input" id="cost-days" style="width:auto;margin-bottom:0">
    <option value="7">7 days</option><option value="30" selected>30 days</option><option value="90">90 days</option>
  </select>
  <input class="input" id="cost-budget" type="number" placeholder="Budget ($)" style="width:100px;margin-bottom:0">
  <button class="btn btn-outline btn-sm" onclick="loadCosts()" style="margin-bottom:0">Refresh</button>
</div>
</div></div>
<div id="cost-breakdown"></div>
</div>

<!-- HEALTH TAB -->
<div class="tab-panel" id="panel-health">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Provider Health</div>
<div class="card-text" style="margin-bottom:12px">Real-time health check of all providers. Uptime and latency percentiles.</div>
<button class="btn btn-white btn-sm" onclick="checkHealth()">Run Health Check</button>
<div id="health-results" style="margin-top:12px"></div>
</div></div>
</div>

<!-- USAGE TAB -->
<div class="tab-panel" id="panel-usage">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Usage Analytics</div>
<div class="card-text" style="margin-bottom:12px">Usage by provider, model, and user over time. Peak hours and popular models.</div>
<select class="input" id="usage-days" style="width:auto" onchange="loadUsage()">
  <option value="1">Last 24h</option><option value="7" selected>7 days</option><option value="30">30 days</option><option value="90">90 days</option>
</select>
<div id="usage-data" style="margin-top:12px"></div>
</div></div>
</div>

<!-- FINE-TUNE TAB -->
<div class="tab-panel" id="panel-finetune">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Model Fine-tuning</div>
<div class="card-text" style="margin-bottom:12px">Submit training data, track jobs, deploy custom models.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Create fine-tune job</summary>
  <div style="margin-top:8px">
    <input class="input" id="ft-name" placeholder="Job name (e.g. customer-support-v1)">
    <select class="input" id="ft-provider" style="width:auto;display:inline-block">
      <option value="fleet">Fleet</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>
    </select>
    <input class="input" id="ft-epochs" type="number" value="3" min="1" max="10" placeholder="Epochs" style="width:100px;display:inline-block">
    <textarea class="input" id="ft-data" placeholder="Training data (JSON array of {prompt, completion} pairs)" style="min-height:100px"></textarea>
    <button class="btn btn-white btn-sm" onclick="createFineTune()">Start Fine-tune</button>
  </div>
</details>
<button class="btn btn-outline btn-sm" onclick="loadFineTuneJobs()">Refresh Jobs</button>
<div id="ft-jobs" style="margin-top:12px"></div>
</div></div>
</div>

<!-- THREADS TAB -->
<div class="tab-panel" id="panel-threads">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Conversation Memory</div>
<div class="card-text" style="margin-bottom:12px">Persistent conversation threads with context window management.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">New conversation</summary>
  <div style="margin-top:8px">
    <input class="input" id="conv-title" placeholder="Conversation title">
    <select class="input" id="conv-provider" style="width:auto;display:inline-block">
      <option value="fleet">Fleet</option><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option>
    </select>
    <textarea class="input" id="conv-system" placeholder="System prompt (optional)"></textarea>
    <button class="btn btn-white btn-sm" onclick="createThread()">Create Thread</button>
  </div>
</details>
<button class="btn btn-outline btn-sm" onclick="loadThreads()">Refresh</button>
<div id="conv-threads" style="margin-top:12px"></div>
<div id="conv-chat" style="margin-top:12px;display:none">
  <div id="conv-messages" style="max-height:300px;overflow-y:auto;margin-bottom:8px"></div>
  <input class="input" id="conv-input" placeholder="Type a message...">
  <button class="btn btn-white btn-sm" onclick="sendThreadMsg()">Send</button>
</div>
</div></div>
</div>

<!-- PERSONAS TAB -->
<div class="tab-panel" id="panel-personas">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Agent Personas</div>
<div class="card-text" style="margin-bottom:12px">Custom AI personas with specific instructions, knowledge, and tone. Includes 26 built-in BlackRoad agents.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Create persona</summary>
  <div style="margin-top:8px">
    <input class="input" id="per-name" placeholder="Persona name">
    <select class="input" id="per-tone">
      <option value="neutral">Neutral</option><option value="professional">Professional</option>
      <option value="casual">Casual</option><option value="friendly">Friendly</option>
      <option value="authoritative">Authoritative</option><option value="creative">Creative</option>
      <option value="technical">Technical</option><option value="humorous">Humorous</option>
    </select>
    <textarea class="input" id="per-system" placeholder="System prompt / instructions"></textarea>
    <textarea class="input" id="per-knowledge" placeholder="Knowledge base (optional)"></textarea>
    <input class="input" id="per-desc" placeholder="Description">
    <button class="btn btn-white btn-sm" onclick="createPersona()">Create Persona</button>
  </div>
</details>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input class="input" id="per-chat-id" placeholder="Persona ID (e.g. agent:lucidia)" style="flex:1;margin-bottom:0">
  <input class="input" id="per-chat-msg" placeholder="Message" style="flex:2;margin-bottom:0">
  <button class="btn btn-outline btn-sm" onclick="chatPersona()" style="margin-bottom:0">Chat</button>
</div>
<div id="per-result" style="margin-bottom:12px"></div>
<button class="btn btn-outline btn-sm" onclick="loadPersonas()">Refresh List</button>
<div id="per-list" style="margin-top:12px"></div>
</div></div>
</div>

<!-- EVAL TAB -->
<div class="tab-panel" id="panel-eval">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Evaluation Suite</div>
<div class="card-text" style="margin-bottom:12px">Benchmark prompts against models. Automated scoring and regression testing.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Create eval suite</summary>
  <div style="margin-top:8px">
    <input class="input" id="eval-name" placeholder="Suite name">
    <textarea class="input" id="eval-prompts" placeholder="Prompts (one per line, or JSON array with {text, expected})" style="min-height:100px"></textarea>
    <button class="btn btn-white btn-sm" onclick="createEvalSuite()">Create Suite</button>
  </div>
</details>
<button class="btn btn-outline btn-sm" onclick="loadEvalSuites()">Refresh</button>
<div id="eval-suites" style="margin-top:12px"></div>
<div id="eval-results" style="margin-top:12px"></div>
</div></div>
</div>

<!-- RATE LIMITS TAB -->
<div class="tab-panel" id="panel-ratelimits">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Rate Limits</div>
<div class="card-text" style="margin-bottom:12px">Per-user and per-provider rate limits, quota management, usage caps.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Set rate limit</summary>
  <div style="margin-top:8px">
    <input class="input" id="rl-user" placeholder="User ID">
    <input class="input" id="rl-provider" placeholder="Provider (* for all)" value="*">
    <div class="grid-2" style="margin-bottom:8px">
      <input class="input" id="rl-rpm" type="number" value="60" placeholder="Req/min" style="margin-bottom:0">
      <input class="input" id="rl-rph" type="number" value="500" placeholder="Req/hour" style="margin-bottom:0">
    </div>
    <input class="input" id="rl-tpd" type="number" value="1000000" placeholder="Tokens/day">
    <button class="btn btn-white btn-sm" onclick="setRateLimit()">Set Limit</button>
  </div>
</details>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input class="input" id="rl-check-user" placeholder="Check user ID" style="flex:1;margin-bottom:0">
  <button class="btn btn-outline btn-sm" onclick="checkRateLimit()" style="margin-bottom:0">Check</button>
</div>
<div id="rl-status"></div>
<button class="btn btn-outline btn-sm" onclick="loadRateLimits()">Refresh</button>
<div id="rl-list" style="margin-top:12px"></div>
</div></div>
</div>

<!-- EMBEDDINGS TAB -->
<div class="tab-panel" id="panel-embeddings">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Embedding Store</div>
<div class="card-text" style="margin-bottom:12px">Generate, store, and search vector embeddings for semantic search.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Store embedding</summary>
  <div style="margin-top:8px">
    <input class="input" id="emb-collection" placeholder="Collection name" value="default">
    <textarea class="input" id="emb-content" placeholder="Content to embed"></textarea>
    <button class="btn btn-white btn-sm" onclick="storeEmbedding()">Store</button>
  </div>
</details>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input class="input" id="emb-search" placeholder="Semantic search query" style="flex:1;margin-bottom:0">
  <input class="input" id="emb-search-coll" placeholder="Collection" value="default" style="width:120px;margin-bottom:0">
  <button class="btn btn-outline btn-sm" onclick="searchEmbeddings()" style="margin-bottom:0">Search</button>
</div>
<div id="emb-results"></div>
<button class="btn btn-outline btn-sm" onclick="loadEmbeddingStats()">Refresh</button>
<div id="emb-stats" style="margin-top:12px"></div>
</div></div>
</div>

<!-- TOOLS TAB -->
<div class="tab-panel" id="panel-tools">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">Tool Registry</div>
<div class="card-text" style="margin-bottom:12px">Register external tools for AI function calling. Execute tools and view history.</div>
<details style="margin-bottom:12px">
  <summary style="font-size:12px;color:var(--sub);cursor:pointer">Register tool</summary>
  <div style="margin-top:8px">
    <input class="input" id="tool-name" placeholder="Tool name (e.g. get-weather)">
    <input class="input" id="tool-desc" placeholder="Description">
    <input class="input" id="tool-endpoint" placeholder="Endpoint URL (optional)">
    <textarea class="input" id="tool-params" placeholder='Parameters schema (JSON, e.g. {"type":"object","properties":{"city":{"type":"string"}}})'></textarea>
    <button class="btn btn-white btn-sm" onclick="registerTool()">Register</button>
  </div>
</details>
<div style="display:flex;gap:8px;margin-bottom:12px">
  <input class="input" id="tool-exec-id" placeholder="Tool ID or name" style="flex:1;margin-bottom:0">
  <input class="input" id="tool-exec-input" placeholder='Input JSON (e.g. {"city":"NYC"})' style="flex:2;margin-bottom:0">
  <button class="btn btn-outline btn-sm" onclick="executeTool()" style="margin-bottom:0">Execute</button>
</div>
<div id="tool-result"></div>
<button class="btn btn-outline btn-sm" onclick="loadTools()">Refresh</button>
<div id="tool-list" style="margin-top:12px"></div>
</div></div>
</div>

<!-- PLAYGROUND TAB -->
<div class="tab-panel" id="panel-playground">
<div class="card"><div class="card-grad"></div><div class="card-body">
<div class="card-title">AI Playground</div>
<div class="card-text" style="margin-bottom:12px">Interactive testing sandbox with parameter tuning.</div>
<div class="grid-2" style="margin-bottom:12px">
  <div>
    <label style="font-size:11px;color:var(--sub)">Provider</label>
    <select class="input" id="pg-provider" style="margin-bottom:4px">
      <option value="fleet">Fleet</option><option value="openai">OpenAI</option>
      <option value="anthropic">Anthropic</option><option value="gemini">Gemini</option>
      <option value="grok">Grok</option><option value="deepseek">DeepSeek</option>
    </select>
  </div>
  <div>
    <label style="font-size:11px;color:var(--sub)">Max Tokens</label>
    <input class="input" id="pg-max-tokens" type="number" value="600" min="50" max="4000" style="margin-bottom:4px">
  </div>
  <div>
    <label style="font-size:11px;color:var(--sub)">Temperature: <span id="pg-temp-val">0.7</span></label>
    <input type="range" id="pg-temp" min="0" max="200" value="70" style="width:100%" oninput="document.getElementById('pg-temp-val').textContent=(this.value/100).toFixed(2)">
  </div>
  <div>
    <label style="font-size:11px;color:var(--sub)">Top P: <span id="pg-topp-val">1.0</span></label>
    <input type="range" id="pg-topp" min="0" max="100" value="100" style="width:100%" oninput="document.getElementById('pg-topp-val').textContent=(this.value/100).toFixed(2)">
  </div>
</div>
<textarea class="input" id="pg-system" placeholder="System prompt (optional)"></textarea>
<textarea class="input" id="pg-message" placeholder="Your message..."></textarea>
<button class="btn btn-white" onclick="playgroundSend()">Send</button>
<button class="btn btn-outline" onclick="playgroundClear()">Clear</button>
<div id="pg-history" style="margin-top:12px"></div>
</div></div>
</div>

<div class="footer"><a href="https://blackroad.io">BlackRoad OS</a> — Pave Tomorrow. v2.0</div>
</div>

<script>
// Tab switching
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
    // Auto-load data for some tabs
    const t = tab.dataset.tab;
    if (t === 'cache') loadCacheStats();
    if (t === 'costs') loadCosts();
    if (t === 'health') checkHealth();
    if (t === 'usage') loadUsage();
    if (t === 'prompts') searchPrompts();
    if (t === 'fallback') loadChains();
    if (t === 'finetune') loadFineTuneJobs();
    if (t === 'threads') loadThreads();
    if (t === 'personas') loadPersonas();
    if (t === 'eval') loadEvalSuites();
    if (t === 'ratelimits') loadRateLimits();
    if (t === 'embeddings') loadEmbeddingStats();
    if (t === 'tools') loadTools();
  });
});

// ─── Convoy ───
async function askConvoy(){
  const q=document.getElementById('question').value.trim();
  if(!q)return;
  const el=document.getElementById('results');
  el.style.display='block';
  el.innerHTML='<div style="color:var(--sub);font-size:13px;padding:16px">Asking the convoy...</div>';
  const r=await fetch('/api/convoy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div style="color:#f55;padding:16px">'+d.error+'</div>';return}
  el.innerHTML=d.convoy.map(c=>'<div class="response"><div class="provider-name">'+esc(c.provider)+' ('+esc(c.type)+')</div>'+esc(c.response)+'</div>').join('');
}

// ─── Hand Off ───
async function handoff(){
  const from=document.getElementById('ho-from').value.trim();
  const to=document.getElementById('ho-to').value.trim();
  const msg=document.getElementById('ho-msg').value.trim();
  if(!from||!to||!msg)return;
  const el=document.getElementById('ho-result');
  el.innerHTML='<div class="response" style="margin-top:12px;color:var(--sub)">Handing off...</div>';
  const r=await fetch('/api/handoff',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({from,to,message:msg})});
  const d=await r.json();
  el.innerHTML='<div class="response" style="margin-top:12px"><div class="provider-name">'+esc(d.from)+' -> '+esc(d.to)+' ('+d.duration_ms+'ms)</div>'+esc(d.output)+'</div>';
}

// ─── Compare ───
async function runCompare(){
  const prompt=document.getElementById('compare-prompt').value.trim();
  if(!prompt)return;
  const checked=Array.from(document.querySelectorAll('#compare-providers input:checked')).map(i=>i.value);
  if(!checked.length){alert('Select at least one provider');return}
  const el=document.getElementById('compare-results');
  el.innerHTML='<div class="card"><div class="card-body" style="color:var(--sub)">Comparing across '+checked.length+' providers...</div></div>';
  const r=await fetch('/api/compare',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,providers:checked})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML=d.comparisons.map((c,i)=>{
    const color=['#22c55e','#3b82f6','#a855f7','#f59e0b','#ef4444','#6366f1'][i%6];
    return '<div class="card"><div class="card-body"><div class="comparison-card" style="border-color:'+color+'"><div class="provider-name">'+esc(c.provider)+' ('+esc(c.model)+') '+(i===0?'WINNER ':'')+c.duration_ms+'ms</div><div style="font-size:13px;margin:6px 0">'+esc(c.response)+'</div><div class="score-bar"><div class="score-fill" style="width:'+c.quality_score+'%"></div></div><div class="mono" style="margin-top:4px">Score: '+c.quality_score+'/100 | ~'+c.tokens_estimated+' tokens'+(c.error?' | Error: '+esc(c.error):'')+'</div></div></div></div>';
  }).join('');
}

// ─── Prompts ───
async function searchPrompts(){
  const q=document.getElementById('prompt-search')?.value.trim()||'';
  const r=await fetch('/api/prompts'+(q?'?q='+encodeURIComponent(q):''));
  const d=await r.json();
  const el=document.getElementById('prompts-list');
  if(!d.prompts?.length){el.innerHTML='<div class="card"><div class="card-body card-text">No prompts yet. Add one above.</div></div>';return}
  el.innerHTML=d.prompts.map(p=>'<div class="card"><div class="card-body"><div style="display:flex;justify-content:space-between;align-items:start"><div class="card-title">'+esc(p.title)+'</div><div><span class="badge badge-white" style="margin-right:4px">'+esc(p.category)+'</span><span class="badge badge-white">'+p.avg_rating.toFixed(1)+'/5 ('+p.ratings_count+')</span></div></div><div class="card-text" style="margin:6px 0">'+esc(p.prompt.slice(0,200))+(p.prompt.length>200?'...':'')+'</div><div class="mono">Used '+p.uses+' times</div><div style="margin-top:6px"><button class="btn btn-outline btn-sm" onclick="usePrompt(\''+p.id+'\')">Use</button><button class="btn btn-outline btn-sm" onclick="ratePrompt(\''+p.id+'\',5)">Rate 5</button><button class="btn btn-outline btn-sm" onclick="ratePrompt(\''+p.id+'\',4)">4</button><button class="btn btn-outline btn-sm" onclick="ratePrompt(\''+p.id+'\',3)">3</button></div></div></div>').join('');
}

async function savePrompt(){
  const title=document.getElementById('prompt-title').value.trim();
  const prompt=document.getElementById('prompt-text').value.trim();
  const category=document.getElementById('prompt-category').value;
  const tags=document.getElementById('prompt-tags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if(!title||!prompt)return;
  await fetch('/api/prompts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,prompt,category,tags})});
  document.getElementById('prompt-title').value='';document.getElementById('prompt-text').value='';document.getElementById('prompt-tags').value='';
  searchPrompts();
}

async function usePrompt(id){
  const r=await fetch('/api/prompts/'+id+'/use',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({execute:true,provider:'fleet'})});
  const d=await r.json();
  const el=document.getElementById('prompts-list');
  el.innerHTML='<div class="response"><div class="provider-name">'+esc(d.provider||'fleet')+' ('+d.duration_ms+'ms)</div>'+esc(d.response||'')+'</div>'+el.innerHTML;
}

async function ratePrompt(id,rating){
  await fetch('/api/prompts/'+id+'/rate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({rating})});
  searchPrompts();
}

// ─── Batch ───
async function runBatch(){
  const text=document.getElementById('batch-prompts').value.trim();
  if(!text)return;
  const prompts=text.split('\\n').filter(l=>l.trim());
  if(!prompts.length)return;
  const provider=document.getElementById('batch-provider').value;
  const el=document.getElementById('batch-results');
  el.innerHTML='<div class="card"><div class="card-body" style="color:var(--sub)">Processing '+prompts.length+' prompts...</div></div>';
  const r=await fetch('/api/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompts,provider})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML='<div class="card"><div class="card-body"><div class="grid-2"><div class="stat-box"><div class="stat-val">'+d.completed+'</div><div class="stat-label">Completed</div></div><div class="stat-box"><div class="stat-val">'+d.failed+'</div><div class="stat-label">Failed</div></div></div></div></div>'+d.results.map(r=>'<div class="response"><div class="provider-name">#'+(r.index+1)+' '+esc(r.provider)+' ('+r.duration_ms+'ms)</div><div class="mono" style="margin-bottom:4px">'+esc(r.prompt)+'</div>'+esc(r.response)+'</div>').join('');
}

// ─── Cache ───
async function loadCacheStats(){
  const r=await fetch('/api/cache');
  const d=await r.json();
  document.getElementById('cache-entries').textContent=d.total_entries;
  document.getElementById('cache-hits').textContent=d.total_hits;
  document.getElementById('cache-rate').textContent=d.hit_rate_pct+'%';
  document.getElementById('cache-expired').textContent=d.expired_entries;
}

async function cacheQuery(){
  const prompt=document.getElementById('cache-prompt').value.trim();
  if(!prompt)return;
  const provider=document.getElementById('cache-provider').value;
  const ttl=parseInt(document.getElementById('cache-ttl').value)||3600;
  const el=document.getElementById('cache-result');
  el.innerHTML='<div class="response" style="color:var(--sub)">Querying...</div>';
  const r=await fetch('/api/cache/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,provider,ttl_seconds:ttl})});
  const d=await r.json();
  el.innerHTML='<div class="response"><div class="provider-name">'+(d.cached?'CACHE HIT ('+d.hits+' hits)':'CACHE MISS')+' | '+esc(d.provider||provider)+'</div>'+esc(d.response||'')+'</div>';
  loadCacheStats();
}

async function clearCache(expiredOnly){
  await fetch('/api/cache',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({expired_only:expiredOnly})});
  loadCacheStats();
}

// ─── Fallback ───
async function loadChains(){
  const r=await fetch('/api/fallback');
  const d=await r.json();
  const el=document.getElementById('fb-chains');
  if(!d.chains?.length){el.innerHTML='<div class="card-text" style="margin-top:8px">No chains yet.</div>';return}
  el.innerHTML=d.chains.map(c=>{
    let chain;try{chain=JSON.parse(c.chain)}catch(e){chain=[]}
    return '<div class="response" style="margin-top:8px"><div class="provider-name">'+esc(c.name)+' ('+c.id+')</div><div class="mono">'+chain.join(' -> ')+'</div><div class="card-text">'+esc(c.description||'')+'</div></div>';
  }).join('');
}

async function createChain(){
  const name=document.getElementById('fb-name').value.trim();
  const chainStr=document.getElementById('fb-chain').value.trim();
  const desc=document.getElementById('fb-desc').value.trim();
  if(!name||!chainStr)return;
  const chain=chainStr.split(',').map(s=>s.trim()).filter(Boolean);
  await fetch('/api/fallback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,chain,description:desc})});
  document.getElementById('fb-name').value='';document.getElementById('fb-chain').value='';document.getElementById('fb-desc').value='';
  loadChains();
}

async function testChain(){
  const chainId=document.getElementById('fb-test-chain').value.trim();
  const prompt=document.getElementById('fb-test-prompt').value.trim();
  if(!chainId||!prompt)return;
  const el=document.getElementById('fb-result');
  el.innerHTML='<div class="response" style="color:var(--sub)">Executing fallback chain...</div>';
  const r=await fetch('/api/fallback/'+encodeURIComponent(chainId)+'/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML='<div class="response"><div class="provider-name">'+esc(d.used_provider||'?')+' | '+(d.fallback_triggered?'FALLBACK TRIGGERED':'First provider succeeded')+' | '+d.duration_ms+'ms</div>'+esc(d.response||'')+'<div class="mono" style="margin-top:8px">Attempts: '+d.attempts.map(a=>esc(a.provider_id)+(a.error?' (fail)':' (ok)')).join(' -> ')+'</div></div>';
}

// ─── Costs ───
async function loadCosts(){
  const days=document.getElementById('cost-days').value;
  const budget=document.getElementById('cost-budget').value||'0';
  const r=await fetch('/api/costs?days='+days+'&budget='+budget);
  const d=await r.json();
  document.getElementById('cost-total').textContent='$'+d.total_cost_usd;
  document.getElementById('cost-tokens').textContent=formatNum(d.total_tokens);
  const el=document.getElementById('cost-breakdown');
  let html='';
  if(d.budget&&d.budget.alert){html+='<div class="card"><div class="card-body" style="border-left:3px solid #ef4444"><div class="card-title" style="color:#ef4444">Budget Alert</div><div class="card-text">'+d.budget.pct_used+'% of $'+d.budget.limit_usd+' budget used. $'+d.budget.remaining_usd+' remaining.</div></div></div>'}
  if(d.breakdown?.length){html+='<div class="card"><div class="card-body"><div class="card-title">By Provider</div>'+d.breakdown.map(b=>'<div class="health-row"><span>'+esc(b.provider)+' ('+esc(b.operation)+')</span><span class="mono">$'+(b.total_cost||0).toFixed(4)+' | '+formatNum(b.total_tokens)+' tokens | '+b.queries+' queries</span></div>').join('')+'</div></div>'}
  if(d.daily?.length){html+='<div class="card"><div class="card-body"><div class="card-title">Daily Breakdown</div>'+d.daily.slice(0,14).map(dd=>'<div class="health-row"><span class="mono">'+dd.date+'</span><span class="mono">$'+(dd.cost||0).toFixed(4)+' | '+formatNum(dd.tokens)+' tokens</span></div>').join('')+'</div></div>'}
  el.innerHTML=html||'<div class="card"><div class="card-body card-text">No cost data yet. Start using providers to track costs.</div></div>';
}

// ─── Health ───
async function checkHealth(){
  const el=document.getElementById('health-results');
  el.innerHTML='<div style="color:var(--sub);font-size:13px">Running health checks...</div>';
  const r=await fetch('/api/providers/health');
  const d=await r.json();
  el.innerHTML=(d.health||[]).map(h=>{
    const color=h.status==='healthy'?'#22c55e':h.status==='reachable'?'#3b82f6':h.status==='degraded'?'#eab308':'#ef4444';
    return '<div class="health-row"><div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+color+';margin-right:8px"></span><strong>'+esc(h.name)+'</strong><span class="mono" style="margin-left:8px">'+h.status+'</span></div><div class="mono">'+h.latency_ms+'ms | p50:'+h.p50_latency+'ms p95:'+h.p95_latency+'ms p99:'+h.p99_latency+'ms | uptime:'+h.uptime_pct+'% ('+h.total_checks+' checks)'+(h.error?' | '+esc(h.error):'')+'</div></div>';
  }).join('')||'<div class="card-text">No providers found.</div>';
}

// ─── Usage ───
async function loadUsage(){
  const days=document.getElementById('usage-days').value;
  const r=await fetch('/api/usage?days='+days);
  const d=await r.json();
  const el=document.getElementById('usage-data');
  let html='<div class="grid-2" style="margin-bottom:12px"><div class="stat-box"><div class="stat-val">'+d.totals.queries+'</div><div class="stat-label">Total Queries</div></div><div class="stat-box"><div class="stat-val">'+formatNum(d.totals.tokens)+'</div><div class="stat-label">Total Tokens</div></div><div class="stat-box"><div class="stat-val">'+d.totals.avg_duration_ms+'ms</div><div class="stat-label">Avg Duration</div></div><div class="stat-box"><div class="stat-val">'+(d.peak_hour?d.peak_hour.hour:'--')+'</div><div class="stat-label">Peak Hour</div></div></div>';
  if(d.by_provider?.length){html+='<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;margin-bottom:6px">By Provider</div>'+d.by_provider.map(p=>'<div class="health-row"><span>'+esc(p.provider)+'<span class="mono" style="margin-left:6px">'+esc(p.model||'')+'</span></span><span class="mono">'+p.queries+' queries | '+formatNum(p.total_tokens)+' tokens | avg '+Math.round(p.avg_duration_ms||0)+'ms</span></div>').join('')+'</div>'}
  if(d.popular_models?.length){html+='<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;margin-bottom:6px">Popular Models</div>'+d.popular_models.map(m=>'<div class="health-row"><span class="mono">'+esc(m.model)+'</span><span class="mono">'+m.queries+' queries</span></div>').join('')+'</div>'}
  if(d.by_operation?.length){html+='<div style="margin-bottom:12px"><div style="font-size:13px;font-weight:600;margin-bottom:6px">By Operation</div>'+d.by_operation.map(o=>'<div class="health-row"><span>'+esc(o.operation)+'</span><span class="mono">'+o.queries+' queries | '+formatNum(o.total_tokens)+' tokens</span></div>').join('')+'</div>'}
  if(d.daily_trend?.length){html+='<div><div style="font-size:13px;font-weight:600;margin-bottom:6px">Daily Trend</div>'+d.daily_trend.map(dd=>'<div class="health-row"><span class="mono">'+dd.date+'</span><span class="mono">'+dd.queries+' queries | '+formatNum(dd.tokens)+' tokens</span></div>').join('')+'</div>'}
  el.innerHTML=html||'<div class="card-text">No usage data yet.</div>';
}

// ─── Helpers ───
function esc(s){if(!s)return'';return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
function formatNum(n){if(!n)return'0';if(n>=1000000)return(n/1000000).toFixed(1)+'M';if(n>=1000)return(n/1000).toFixed(1)+'K';return String(n)}

// ─── Fine-tune ───
async function createFineTune(){
  const name=document.getElementById('ft-name').value.trim();
  const provider=document.getElementById('ft-provider').value;
  const epochs=parseInt(document.getElementById('ft-epochs').value)||3;
  let data;
  try{data=JSON.parse(document.getElementById('ft-data').value)}catch(e){alert('Invalid JSON for training data');return}
  if(!name||!data?.length)return;
  const r=await fetch('/api/fine-tune',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,provider,epochs,training_data:data})});
  const d=await r.json();
  if(d.error){alert(d.error);return}
  document.getElementById('ft-name').value='';document.getElementById('ft-data').value='';
  loadFineTuneJobs();
}

async function loadFineTuneJobs(){
  const r=await fetch('/api/fine-tune');
  const d=await r.json();
  const el=document.getElementById('ft-jobs');
  if(!d.jobs?.length){el.innerHTML='<div class="card-text">No fine-tune jobs yet.</div>';return}
  el.innerHTML=d.jobs.map(j=>'<div class="response"><div class="provider-name">'+esc(j.name)+' ('+j.id+')</div><div class="mono">Status: '+j.status+' | Model: '+esc(j.base_model||'')+' | '+j.training_count+' examples | '+j.epochs+' epochs | '+j.progress_pct+'%</div><div class="score-bar"><div class="score-fill" style="width:'+j.progress_pct+'%"></div></div>'+(j.status!=='completed'?'<button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="deployFineTune(\''+j.id+'\')">Deploy</button>':'<div class="mono" style="margin-top:4px">Model: '+esc(j.result_model||'')+'</div>')+'</div>').join('');
}

async function deployFineTune(id){
  await fetch('/api/fine-tune/'+id+'/deploy',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})});
  loadFineTuneJobs();
}

// ─── Conversation Threads ───
let activeThreadId=null;
async function createThread(){
  const title=document.getElementById('conv-title').value.trim()||'New conversation';
  const provider=document.getElementById('conv-provider').value;
  const sys=document.getElementById('conv-system').value.trim();
  const r=await fetch('/api/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,provider,system_prompt:sys||undefined})});
  const d=await r.json();
  if(d.ok){document.getElementById('conv-title').value='';document.getElementById('conv-system').value='';loadThreads()}
}

async function loadThreads(){
  const r=await fetch('/api/conversation');
  const d=await r.json();
  const el=document.getElementById('conv-threads');
  if(!d.threads?.length){el.innerHTML='<div class="card-text">No threads yet.</div>';return}
  el.innerHTML=d.threads.map(t=>'<div class="response" style="cursor:pointer" onclick="openThread(\''+t.id+'\')"><div class="provider-name">'+esc(t.title)+' ('+t.id+')</div><div class="mono">'+esc(t.provider)+' | '+t.message_count+' messages | '+t.total_tokens+' tokens</div></div>').join('');
}

async function openThread(id){
  activeThreadId=id;
  const r=await fetch('/api/conversation/'+id);
  const d=await r.json();
  const chat=document.getElementById('conv-chat');
  chat.style.display='block';
  const el=document.getElementById('conv-messages');
  el.innerHTML=(d.messages||[]).map(m=>'<div class="response" style="margin-bottom:4px;'+(m.role==='user'?'border-left:3px solid #3b82f6;padding-left:8px':'border-left:3px solid #22c55e;padding-left:8px')+'"><div class="provider-name">'+m.role+'</div>'+esc(m.content)+'</div>').join('');
  el.scrollTop=el.scrollHeight;
}

async function sendThreadMsg(){
  if(!activeThreadId)return;
  const msg=document.getElementById('conv-input').value.trim();
  if(!msg)return;
  document.getElementById('conv-input').value='';
  const el=document.getElementById('conv-messages');
  el.innerHTML+='<div class="response" style="margin-bottom:4px;border-left:3px solid #3b82f6;padding-left:8px"><div class="provider-name">user</div>'+esc(msg)+'</div>';
  el.innerHTML+='<div class="response" style="margin-bottom:4px;color:var(--sub)">Thinking...</div>';
  const r=await fetch('/api/conversation/'+activeThreadId+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
  const d=await r.json();
  openThread(activeThreadId);
}

// ─── Personas ───
async function createPersona(){
  const name=document.getElementById('per-name').value.trim();
  const tone=document.getElementById('per-tone').value;
  const sys=document.getElementById('per-system').value.trim();
  const know=document.getElementById('per-knowledge').value.trim();
  const desc=document.getElementById('per-desc').value.trim();
  if(!name||!sys)return;
  await fetch('/api/personas',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,tone,system_prompt:sys,knowledge:know,description:desc})});
  document.getElementById('per-name').value='';document.getElementById('per-system').value='';document.getElementById('per-knowledge').value='';document.getElementById('per-desc').value='';
  loadPersonas();
}

async function loadPersonas(){
  const r=await fetch('/api/personas');
  const d=await r.json();
  const el=document.getElementById('per-list');
  if(!d.personas?.length){el.innerHTML='<div class="card-text">No personas.</div>';return}
  el.innerHTML=d.personas.map(p=>'<div class="response"><div class="provider-name">'+esc(p.name)+(p.builtin?' (built-in)':'')+' | '+esc(p.id)+'</div><div class="card-text">'+esc(p.description||p.role||'')+'</div>'+(p.voice?'<div class="mono" style="margin-top:4px;font-style:italic">"'+esc(p.voice)+'"</div>':'')+(p.tone?'<span class="badge badge-white" style="margin-top:4px">'+esc(p.tone)+'</span>':'')+'</div>').join('');
}

async function chatPersona(){
  const id=document.getElementById('per-chat-id').value.trim();
  const msg=document.getElementById('per-chat-msg').value.trim();
  if(!id||!msg)return;
  const el=document.getElementById('per-result');
  el.innerHTML='<div class="response" style="color:var(--sub)">Thinking...</div>';
  const r=await fetch('/api/personas/'+encodeURIComponent(id)+'/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML='<div class="response"><div class="provider-name">'+esc(d.persona||'')+' | '+esc(d.provider||'')+' | '+d.duration_ms+'ms</div>'+esc(d.response||'')+'</div>';
}

// ─── Eval ───
async function createEvalSuite(){
  const name=document.getElementById('eval-name').value.trim();
  const raw=document.getElementById('eval-prompts').value.trim();
  if(!name||!raw)return;
  let prompts;
  try{prompts=JSON.parse(raw)}catch(e){prompts=raw.split('\\n').filter(l=>l.trim()).map(l=>({text:l.trim()}))}
  if(!Array.isArray(prompts))prompts=[prompts];
  await fetch('/api/eval',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,prompts})});
  document.getElementById('eval-name').value='';document.getElementById('eval-prompts').value='';
  loadEvalSuites();
}

async function loadEvalSuites(){
  const r=await fetch('/api/eval');
  const d=await r.json();
  const el=document.getElementById('eval-suites');
  if(!d.suites?.length){el.innerHTML='<div class="card-text">No eval suites yet.</div>';return}
  el.innerHTML=d.suites.map(s=>'<div class="response"><div class="provider-name">'+esc(s.name)+' ('+s.id+') | '+s.prompts.length+' prompts</div><div class="card-text">'+esc(s.description||s.scoring_criteria||'')+'</div><button class="btn btn-outline btn-sm" style="margin-top:6px" onclick="runEval(\''+s.id+'\')">Run (Fleet)</button></div>').join('');
}

async function runEval(suiteId){
  const el=document.getElementById('eval-results');
  el.innerHTML='<div class="response" style="color:var(--sub)">Running evaluation...</div>';
  const r=await fetch('/api/eval/'+suiteId+'/run',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({provider:'fleet'})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML='<div class="card"><div class="card-body"><div class="grid-2" style="margin-bottom:12px"><div class="stat-box"><div class="stat-val">'+d.avg_score+'</div><div class="stat-label">Avg Score /100</div></div><div class="stat-box"><div class="stat-val">'+d.total_duration_ms+'ms</div><div class="stat-label">Total Time</div></div></div>'+d.results.map(r=>'<div class="response" style="margin-bottom:6px"><div class="provider-name">#'+(r.index+1)+' Score: '+r.score+'/100 | '+r.duration_ms+'ms</div><div class="mono" style="margin-bottom:4px">'+esc(r.prompt)+'</div>'+esc(r.response||'')+(r.error?'<div style="color:#f55;margin-top:4px">'+esc(r.error)+'</div>':'')+'</div>').join('')+'</div></div>';
}

// ─── Rate Limits ───
async function setRateLimit(){
  const userId=document.getElementById('rl-user').value.trim();
  const provider=document.getElementById('rl-provider').value.trim()||'*';
  const rpm=parseInt(document.getElementById('rl-rpm').value)||60;
  const rph=parseInt(document.getElementById('rl-rph').value)||500;
  const tpd=parseInt(document.getElementById('rl-tpd').value)||1000000;
  if(!userId)return;
  await fetch('/api/rate-limits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({user_id:userId,provider,max_requests_per_min:rpm,max_requests_per_hour:rph,max_tokens_per_day:tpd})});
  loadRateLimits();
}

async function checkRateLimit(){
  const userId=document.getElementById('rl-check-user').value.trim();
  if(!userId)return;
  const r=await fetch('/api/rate-limits/check/'+encodeURIComponent(userId));
  const d=await r.json();
  const el=document.getElementById('rl-status');
  const color=d.allowed?'#22c55e':'#ef4444';
  el.innerHTML='<div class="response"><div class="provider-name" style="color:'+color+'">'+(d.allowed?'ALLOWED':'BLOCKED')+'</div>'+(d.current?'<div class="mono">Req/min: '+d.current.requests_this_min+' | Req/hr: '+d.current.requests_this_hour+' | Tokens today: '+formatNum(d.current.tokens_today)+'</div>':'')+(d.usage_pct?'<div class="grid-2" style="margin-top:6px"><div class="stat-box"><div class="stat-val">'+d.usage_pct.minute+'%</div><div class="stat-label">Min</div></div><div class="stat-box"><div class="stat-val">'+d.usage_pct.hour+'%</div><div class="stat-label">Hour</div></div></div>':'')+(d.reasons?'<div style="color:#f55;margin-top:4px;font-size:12px">'+d.reasons.join(', ')+'</div>':'')+'</div>';
}

async function loadRateLimits(){
  const r=await fetch('/api/rate-limits');
  const d=await r.json();
  const el=document.getElementById('rl-list');
  if(!d.rate_limits?.length){el.innerHTML='<div class="card-text">No rate limits configured.</div>';return}
  el.innerHTML=d.rate_limits.map(l=>'<div class="response"><div class="provider-name">'+esc(l.user_id)+' | provider: '+esc(l.provider)+'</div><div class="mono">'+l.max_requests_per_min+' req/min | '+l.max_requests_per_hour+' req/hr | '+formatNum(l.max_tokens_per_day)+' tok/day</div></div>').join('');
}

// ─── Embeddings ───
async function storeEmbedding(){
  const collection=document.getElementById('emb-collection').value.trim()||'default';
  const content=document.getElementById('emb-content').value.trim();
  if(!content)return;
  await fetch('/api/embeddings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({content,collection})});
  document.getElementById('emb-content').value='';
  loadEmbeddingStats();
}

async function searchEmbeddings(){
  const query=document.getElementById('emb-search').value.trim();
  const collection=document.getElementById('emb-search-coll').value.trim()||'default';
  if(!query)return;
  const el=document.getElementById('emb-results');
  el.innerHTML='<div class="response" style="color:var(--sub)">Searching...</div>';
  const r=await fetch('/api/embeddings/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query,collection,top_k:10})});
  const d=await r.json();
  if(!d.results?.length){el.innerHTML='<div class="card-text">No results found.</div>';return}
  el.innerHTML=d.results.map(e=>'<div class="response"><div class="provider-name">Similarity: '+(e.similarity*100).toFixed(1)+'% | '+e.id+'</div>'+esc(e.content)+'</div>').join('');
}

async function loadEmbeddingStats(){
  const r=await fetch('/api/embeddings');
  const d=await r.json();
  const el=document.getElementById('emb-stats');
  el.innerHTML='<div class="mono">Collection "'+esc(d.collection)+'": '+d.count+' embeddings</div>'+(d.all_collections?.length?'<div style="margin-top:6px">'+d.all_collections.map(c=>'<span class="badge badge-white" style="margin-right:4px">'+esc(c.collection)+': '+c.count+'</span>').join('')+'</div>':'');
}

// ─── Tools ───
async function registerTool(){
  const name=document.getElementById('tool-name').value.trim();
  const desc=document.getElementById('tool-desc').value.trim();
  const endpoint=document.getElementById('tool-endpoint').value.trim();
  let params={};
  try{const raw=document.getElementById('tool-params').value.trim();if(raw)params=JSON.parse(raw)}catch(e){alert('Invalid JSON for parameters');return}
  if(!name||!desc)return;
  await fetch('/api/tools',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,description:desc,endpoint,parameters:params})});
  document.getElementById('tool-name').value='';document.getElementById('tool-desc').value='';document.getElementById('tool-endpoint').value='';document.getElementById('tool-params').value='';
  loadTools();
}

async function executeTool(){
  const id=document.getElementById('tool-exec-id').value.trim();
  let input={};
  try{const raw=document.getElementById('tool-exec-input').value.trim();if(raw)input=JSON.parse(raw)}catch(e){alert('Invalid JSON input');return}
  if(!id)return;
  const el=document.getElementById('tool-result');
  el.innerHTML='<div class="response" style="color:var(--sub)">Executing...</div>';
  const r=await fetch('/api/tools/'+encodeURIComponent(id)+'/execute',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({input})});
  const d=await r.json();
  if(d.error){el.innerHTML='<div class="response" style="color:#f55">'+esc(d.error)+'</div>';return}
  el.innerHTML='<div class="response"><div class="provider-name">'+esc(d.tool||'')+' | '+d.status+' | '+d.duration_ms+'ms</div><pre class="mono" style="white-space:pre-wrap;margin-top:4px">'+esc(JSON.stringify(d.output,null,2))+'</pre></div>';
}

async function loadTools(){
  const r=await fetch('/api/tools');
  const d=await r.json();
  const el=document.getElementById('tool-list');
  if(!d.tools?.length){el.innerHTML='<div class="card-text">No tools registered.</div>';return}
  el.innerHTML=d.tools.map(t=>'<div class="response"><div class="provider-name">'+esc(t.name)+' ('+t.id+') | '+(t.active?'active':'inactive')+' | '+t.uses+' uses</div><div class="card-text">'+esc(t.description)+'</div>'+(t.endpoint?'<div class="mono" style="margin-top:4px">'+esc(t.endpoint)+'</div>':'<div class="mono" style="margin-top:4px;color:var(--muted)">No endpoint (simulated)</div>')+'</div>').join('');
}

// ─── Playground ───
let pgHistory=[];
async function playgroundSend(){
  const provider=document.getElementById('pg-provider').value;
  const maxTokens=parseInt(document.getElementById('pg-max-tokens').value)||600;
  const temp=parseInt(document.getElementById('pg-temp').value)/100;
  const topP=parseInt(document.getElementById('pg-topp').value)/100;
  const sys=document.getElementById('pg-system').value.trim();
  const msg=document.getElementById('pg-message').value.trim();
  if(!msg)return;
  document.getElementById('pg-message').value='';
  const el=document.getElementById('pg-history');
  pgHistory.push({role:'user',content:msg});
  if(pgHistory.length>100)pgHistory=pgHistory.slice(-100);
  el.innerHTML+=('<div class="response" style="margin-bottom:4px;border-left:3px solid #3b82f6;padding-left:8px"><div class="provider-name">you</div>'+esc(msg)+'</div>');
  el.innerHTML+=('<div class="response" style="margin-bottom:4px;color:var(--sub)">Generating...</div>');
  const r=await fetch('/api/playground/quick',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:msg,provider,max_tokens:maxTokens,temperature:temp,top_p:topP,system_prompt:sys||undefined})});
  const d=await r.json();
  pgHistory.push({role:'assistant',content:d.response||''});
  // Re-render full history
  el.innerHTML=pgHistory.map(m=>'<div class="response" style="margin-bottom:4px;border-left:3px solid '+(m.role==='user'?'#3b82f6':'#22c55e')+';padding-left:8px"><div class="provider-name">'+m.role+'</div>'+esc(m.content)+'</div>').join('');
  if(d.duration_ms)el.innerHTML+='<div class="mono" style="color:var(--sub);margin-top:4px">'+esc(d.provider||'')+' | '+d.duration_ms+'ms | ~'+d.tokens_estimated+' tokens | temp='+d.params?.temperature+' top_p='+d.params?.top_p+'</div>';
}

function playgroundClear(){pgHistory=[];document.getElementById('pg-history').innerHTML=''}

// ─── Tab auto-load additions ───
const origTabHandler = null;

// ─── Init stats ───
fetch('/api/stats').then(r=>r.json()).then(d=>{
  document.getElementById('stat-providers').textContent=d.providers||1;
  document.getElementById('stat-handoffs').textContent=d.handoffs||0;
  document.getElementById('stat-memory').textContent=d.shared_memory||0;
  document.getElementById('stat-prompts').textContent=d.prompts||0;
  document.getElementById('stat-cache').textContent=d.cache_entries||0;
}).catch(()=>{});
window.addEventListener('message',function(e){if(e.data</script></script>e.data.type==='blackroad-os:context'){window._osUser=e.data.user;window._osToken=e.data.token;}});if(window.parent!==window)window.parent.postMessage({type:'blackroad-os:request-context'},'*');
</script></body></html>`;
