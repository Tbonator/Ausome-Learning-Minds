export const REPOSITORY = 'Tbonator/Ausome-Learning-Minds';
export const BRANCH = 'main';
const CONTENT_PATH = 'src/content/workshops.json';

export class WorkshopRepository {
  constructor(token, request = fetch) {
    this.token = token;
    this.request = request;
    this.contentSha = null;
  }

  async api(path, method = 'GET', body) {
    const response = await this.request(`https://api.github.com/repos/${REPOSITORY}/${path}`, {
      method, headers: {
        Accept:'application/vnd.github+json', Authorization:`Bearer ${this.token}`,
        'X-GitHub-Api-Version':'2022-11-28', ...(body ? {'Content-Type':'application/json'} : {}),
      }, ...(body ? {body:JSON.stringify(body)} : {}),
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('GitHub could not verify this access token.');
      if (response.status === 403) throw new Error('Access denied. Check token expiry, repository access, and Contents read/write permission.');
      if (response.status === 404) throw new Error('Repository content is unavailable. Deploy this admin feature to main first and check token access.');
      throw new Error(`GitHub request failed (${response.status}). Changes have not been confirmed as published. Reload published content before trying again.`);
    }
    return response.json();
  }

  async head() {
    return (await this.api(`git/ref/heads/${BRANCH}`)).object.sha;
  }

  async fileAt(ref) {
    return this.api(`contents/${CONTENT_PATH}?ref=${encodeURIComponent(ref)}`);
  }

  async load() {
    const file = await this.fileAt(await this.head());
    const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), c => c.charCodeAt(0));
    const data = JSON.parse(new TextDecoder().decode(bytes));
    this.contentSha = file.sha;
    return data;
  }

  async publish(data, uploads, progress = () => {}) {
    if (!this.contentSha) throw new Error('Connect and load published content before publishing.');
    const head = await this.head();
    const current = await this.fileAt(head);
    if (current.sha !== this.contentSha) throw new Error('Someone changed this page since you opened it. Keep a copy of your edits, then reload published content to avoid overwriting their work.');
    const parent = await this.api(`git/commits/${head}`);
    const tree = [];
    for (const [path, photo] of uploads) {
      if (!data.photos.some(item => item.src === path)) continue;
      progress('Uploading photos…');
      const blob = await this.api('git/blobs', 'POST', {encoding:'base64', content:photo.base64});
      tree.push({path, mode:'100644', type:'blob', sha:blob.sha});
    }
    const contentBlob = await this.api('git/blobs', 'POST', {encoding:'utf-8', content:JSON.stringify(data, null, 2) + '\n'});
    tree.push({path:CONTENT_PATH, mode:'100644', type:'blob', sha:contentBlob.sha});
    progress('Saving page and event changes…');
    const nextTree = await this.api('git/trees', 'POST', {base_tree:parent.tree.sha, tree});
    const commit = await this.api('git/commits', 'POST', {
      message:'Update workshops and events through owner admin', tree:nextTree.sha, parents:[head],
    });
    // Never force: a concurrent branch update must fail instead of losing another person's work.
    await this.api(`git/refs/heads/${BRANCH}`, 'PATCH', {sha:commit.sha, force:false});
    this.contentSha = contentBlob.sha;
    return commit.sha;
  }

  disconnect() { this.token = ''; this.contentSha = null; }
}
