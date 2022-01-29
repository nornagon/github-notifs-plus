/**
 * @typedef {Object.<string, Array<{ id: number, notificationsItemDOM: Array<Element> }>>} NotificationInfo
 */

/**
 * @typedef {Object.<string, Array<{ id: number, labels: Array<{ color: string, description: string, name: string, url: string }> }>>} NotificationLabel
 */

const accessToken = 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxx';

/**
 * query repo and id in /notifications page
 * 
 * @returns {null | NotificationInfo}
 */
const notificationRepoAndID = () => {
  const notificationsItems = document.querySelectorAll('li.notifications-list-item');

  if (notificationsItems.length === 0) {
    return null;
  }

  const result = {};

  for (const item of notificationsItems) {
    const isDiscussion = !!item.querySelector(
      'a.notification-list-item-link svg.octicon-comment-discussion',
    );

    // not supported at the moment Discussion
    if (isDiscussion) {
      continue;
    }

    const isAlert = !!item.querySelector('a.notification-list-item-link svg.octicon-alert');

    // not supported at the moment alert
    if (isAlert) {
      continue;
    }

    const [repo, id] = item
      .querySelector('div[id^=notification_] > div > p:first-of-type')
      ?.textContent.replace(/\s/g, '')
      .split('#') || [null, null];

    if (!repo || !id) {
      console.warn('parse notification item dom failed');
      continue;
    }

    const info = {
      id: Number(id),
      notificationsItemDOM: item,
    };

    if (typeof result[repo] === 'undefined') {
      result[repo] = [info];
    } else {
      result[repo].push(info);
    }
  }

  return result;
};

/**
 * Form a GraphQL query for the given notifications
 * @param {NotificationInfo} data
 * @returns {Promise<null | NotificationLabel>}
 */
const repositoryGraphQL = async data => {
  const gql = `
     {
       ${Object.entries(data).map(([repo, info], index) => {
         const [owner, name] = repo.split('/');

         return `
           repo${index}: repository(owner: "${owner}", name: "${name}") {
             nameWithOwner
             ${info.map((issue, i) => {
               return `issue${i}: issueOrPullRequest(number: ${issue.id}) { ... on Issue { ...IssueFragment } ... on PullRequest { ...PRFragment } }`;
             })}
           }
         `;
       })}
     }

     fragment IssueFragment on Issue {
       number
       labels(first: 100) {
         nodes {
           name
           color
           description
           url
         }
       }
     }
     fragment PRFragment on PullRequest {
       number
       labels(first: 100) {
         nodes {
           name
           color
           description
           url
         }
       }
     }
   `;

  const resp = await fetch('https://api.github.com/graphql', {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    method: 'POST',
    body: JSON.stringify({
      query: gql,
    }),
  });

  if (!resp.ok) {
    return null;
  }

  const reposData = (await resp.json()).data;
  const result = {};

  for (const repoData of Object.values(reposData)) {
    const repo = repoData.nameWithOwner;

    for (const issueData of Object.values(repoData)) {
      if (typeof issueData === 'string') {
        continue;
      }

      const { number, labels } = issueData;

      if (labels.nodes.length === 0) {
        continue;
      }

      const info = {
        id: number,
        labels: labels.nodes,
      };

      if (typeof result[repo] === 'undefined') {
        result[repo] = [info];
      } else {
        result[repo].push(info);
      }
    }
  }

  return result;
};

/**
 * parse label color
 * @param {[number, number, number, number, number, number]} color - Issues/PR label color
 * @returns {r: number, g: number, b: number, h: number, s: number, l: number]}
 */
const parseColor = (() => {
  return color => {
    const r = +('0x' + color[0] + color[1]);
    const g = +('0x' + color[2] + color[3]);
    const b = +('0x' + color[4] + color[5]);

    return { r, g, b, ...rgbToHsl(r, g, b) };
  };

  function rgbToHsl(r, g, b) {
    (r /= 255), (g /= 255), (b /= 255);

    const max = Math.max(r, g, b),
      min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max == min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }

      h /= 6;
    }

    return { h, s, l };
  }
})();

/**
 *
 * @param {NotificationInfo} notificationInfo
 * @param {NotificationLabel} notificationLabel
 */
const annotateIssue = (notificationInfo, notificationLabel) => {
  Object.entries(notificationLabel).forEach(([repo, infos]) => {
    for (const { id, labels } of infos) {
      const liDOM = notificationInfo[repo].find(
        repoInfo => repoInfo.id === id,
      ).notificationsItemDOM;

      injectLabel(repo, liDOM, labels);
    }
  });

  function injectLabel(repo, li, labels) {
    const parent = li.querySelector('a.notification-list-item-link');
    const labelContainer = document.createElement('div');
    parent.children[1].after(labelContainer);

    for (const label of labels) {
      const { r, g, b, h, s, l } = parseColor(label.color);
      const a = document.createElement('a');
      a.href = `/${repo}/labels/${encodeURIComponent(label.name)}`;
      a.target = '_blank';
      a.setAttribute('data-name', label.name);
      a.style.setProperty('--label-r', r);
      a.style.setProperty('--label-g', g);
      a.style.setProperty('--label-b', b);
      a.style.setProperty('--label-h', h);
      a.style.setProperty('--label-s', s);
      a.style.setProperty('--label-l', l);
      a.classList.add('IssueLabel');
      a.classList.add('hx_IssueLabel');
      a.classList.add('mr-1');
      a.textContent = emojify(label.name);
      labelContainer.appendChild(a);
    }
  }

  function emojify(text) {
    return text.replaceAll(/:([^:]+):/g, (match, p1) => {
      return (
        {
          beetle: '🪲',
          leftwards_arrow_with_hook: '↩️',
          sparkles: '✨',
        }[p1] ?? match
      );
    });
  }
};

(async () => {
  const notificationData = notificationRepoAndID();

  if (notificationData === null) {
    return;
  }

  const repositoryGraphQLResult = await repositoryGraphQL(notificationData);

  if (repositoryGraphQLResult === null) {
    return;
  }

  annotateIssue(notificationData, repositoryGraphQLResult);
})();
