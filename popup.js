const checkButton = document.getElementById('check');
const applyButton = document.getElementById('apply');
const accessTokenInput = document.getElementById('accessToken');

const successHandler = () => {
  accessTokenInput.classList.remove('failed');
  accessTokenInput.classList.add('success');
  applyButton.classList.remove('disable');
}

const errorHandler = () => {
  accessTokenInput.classList.remove('success');
  accessTokenInput.classList.add('failed');
  applyButton.classList.add('disable');
}

chrome.storage.sync.get(data => {
  if (data?.accessToken) {
    accessTokenInput.value = data.accessToken;
  }

  if (data?.status) {
    data.status === 'failed' ? errorHandler() : successHandler();
  }
});


const check = async () => {
  const accessToken = accessTokenInput.value;

  if (accessToken === '') {
    return errorHandler();
  }

  try {
    checkButton.innerText = 'Checking...';
    const resp = await fetch('https://api.github.com/users/codertocat', {
      headers: {
        Authorization: `token ${accessTokenInput.value}`
      },
      method: 'HEAD'
    });

    resp.ok ? successHandler() : errorHandler();
  } catch (error) {
    console.warn(error);
    errorHandler();
  } finally {
    checkButton.innerText = 'Check'
  }
}

const apply = () => {
  if (applyButton.classList.contains('disable')) {
    return;
  }

  chrome.storage.sync.set({
    accessToken: accessTokenInput.value,
    status: 'success',
  });
}

checkButton.onclick = check;

applyButton.onclick = apply;
