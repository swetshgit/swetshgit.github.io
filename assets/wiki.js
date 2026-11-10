// Register completed articles here; drafts stay out of public navigation.
const wikiArticles = {
    'clear-path': { title: 'Clear Path', source: 'wiki/projects/clear-path.md' },
    'co2-emissions-optimizer': { title: 'CO2 emissions: a CUDA preprocessing exercise', source: 'wiki/projects/co2-emissions-optimizer.md' },
    pneumaai: { title: 'PneumaAI', source: 'wiki/projects/pneumaai.md' },
};
let wikiRequest = 0;
async function loadWikiArticle(slug) {
    const request = ++wikiRequest;
    const article = wikiArticles[slug];
    const title = document.getElementById('wiki-title');
    const status = document.getElementById('wiki-status');
    const body = document.getElementById('wiki-article');
    const source = document.getElementById('wiki-source');
    body.replaceChildren();
    source.hidden = !article;
    title.textContent = article?.title || 'Article not found';
    status.textContent = article ? 'Loading article...' : 'This article is not available. Browse Blogs for published articles.';
    if (!article) return;
    source.href = article.source;
    try {
        const response = await fetch(article.source);
        if (!response.ok) throw new Error('Article request failed');
        const markdown = await response.text();
        if (request !== wikiRequest) return;
        // Only repository-owned Markdown from the explicit registry is rendered.
        body.innerHTML = marked.parse(markdown.replace(/^# .+\r?\n/, ''));
        status.textContent = '';
    } catch {
        if (request !== wikiRequest) return;
        status.textContent = location.protocol === 'file:'
            ? 'Serve this folder over HTTP to read articles, or use the Markdown source link below.'
            : 'The article could not be loaded. Please try again or open the Markdown source below.';
    }
}