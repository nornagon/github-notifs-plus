function rgbToHsl(r, g, b) {
  r /= 255, g /= 255, b /= 255;

  var max = Math.max(r, g, b), min = Math.min(r, g, b);
  var h, s, l = (max + min) / 2;

  if (max == min) {
    h = s = 0; // achromatic
  } else {
    var d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }

    h /= 6;
  }

  return [ h, s, l ];
}

const cache = new Map
async function getIssueData(repo, id) {
  const key = `${repo}#${id}`
  if (cache.has(key)) {
    return cache.get(key)
  }
  const resp = await fetch(`https://api.github.com/repos/${repo}/issues/${id}`)
  if (!resp.ok) {
    cache.set(key, null)
    return null
  }
  const data = await resp.json()
  cache.set(key, data)
  return data
}

async function annotateIssue(li) {
  const id = li.querySelector('span.text-normal.color-fg-muted').textContent.trim().substr(1)
  const repo = li.querySelector('.f6').firstChild.textContent.trim()
  const issue = await getIssueData(repo, id)
  if (!issue) return
  const parent = li.querySelector('a.notification-list-item-link')
  const labelContainer = document.createElement('div')
  parent.children[1].after(labelContainer)
  for (const label of issue.labels) {
    const c = label.color
    const r = +("0x" + c[0] + c[1]);
    const g = +("0x" + c[2] + c[3]);
    const b = +("0x" + c[4] + c[5]);
    const [h, s, l] = rgbToHsl(r, g, b)
    const a = document.createElement('a')
    a.href = `/${repo}/labels/${encodeURIComponent(label.name)}`
    a.setAttribute('data-name', label.name)
    a.style.setProperty('--label-r', r)
    a.style.setProperty('--label-g', g)
    a.style.setProperty('--label-b', b)
    a.style.setProperty('--label-h', h)
    a.style.setProperty('--label-s', s)
    a.style.setProperty('--label-l', l)
    a.classList.add('IssueLabel')
    a.classList.add('hx_IssueLabel')
    a.classList.add('mr-1')
    a.textContent = emojify(label.name)
    labelContainer.appendChild(a)
  }
}
setInterval(() => {
  const query = document.querySelectorAll('li.notifications-list-item:not(.gh-notifs-plus-watched)')
  for (const li of query) {
    li.classList.add('gh-notifs-plus-watched')
    annotateIssue(li)
  }
}, 1000)

function emojify(text) {
  return text.replaceAll(/:([^:]+):/g, (match, p1) => {
    return {
      'beetle': '🪲',
      'leftwards_arrow_with_hook': '↩️',
      'sparkles': '✨',
    }[p1] ?? match
  })
}
