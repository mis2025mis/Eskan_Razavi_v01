// ----- Helper Functions -----
const getCookie = (name) => {
  let cookieValue = null;
  if (document.cookie && document.cookie !== '') {
    const cookies = document.cookie.split(';');
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].trim();
      if (cookie.substring(0, name.length + 1) === (name + '=')) {
        cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
        break;
      }
    }
  }
  return cookieValue;
};

// ---- define new fetch ----
const originalFetch = window.fetch;
window.fetch = function(url, options = {}) {
  const csrfToken = getCookie('csrftoken');
  const isInternal = url.startsWith(API_URL) || url.startsWith('/');

  if (isInternal) {
    options.headers = {
      ...(options.headers || {}),
      'X-CSRFToken': csrfToken,
      'Content-Type': 'application/json',
    };
  }

  return originalFetch(url, options);
};

// ----- DOM Elements -----
const $ = document;

const exitButton = $.querySelector(".exit-button");
const setExitButton = $.querySelector(".set-exit-button");
const signupButton = $.querySelector(".signup-button");
const adminpanelButton = $.querySelector(".adminpanel-button");

const exitPage = $.querySelector(".exit-page");
const setExitPage = $.querySelector(".set-exit-page");
const signupPage = $.querySelector(".signup-page");
const adminpanelPage = $.querySelector(".adminpanel-page");
let users = [];

// ---- Toast ----
function showToast(message = "عملیات با موفقیت انجام شد", type = "success") {
  const toast = document.getElementById('toast');
  const toastMessage = document.getElementById('toast-message');

  toastMessage.innerText = message;
  toast.classList.remove('bg-green-500', 'bg-red-500', 'bg-yellow-500');

  if (type === 'success') toast.classList.add('bg-green-500');
  else if (type === 'error') toast.classList.add('bg-red-500');

  toast.classList.remove('hidden');
  toast.classList.add('flex');

  setTimeout(() => hideToast(), 3000);
}

function hideToast() {
  const toast = document.getElementById('toast');
  toast.classList.add('hidden');
  toast.classList.remove('flex');
}

// ----- Fetch Admin Settings -----
const fetchAdminSettingsData = () => {
  fetch(`${API_URL}/admin_page/`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      $.querySelector('.active-guests').innerHTML = `${data.active_guests}/${data.capacity}`;
      $.querySelector('.admin-highest-settlement-time').innerHTML = `${data.highest_settlement_time} ساعت`;
    })
    .catch(console.error);
};

// ----- Fetch Set Exit Data -----
const fetchSetExitData = () => {
  fetch(`${API_URL}/set_exit_page/`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      const tableBody = $.querySelector('.activeGuestsTable tbody');
      tableBody.innerHTML = "";
      users = data.Data;
      data.Data.forEach(item => {
        tableBody.insertAdjacentHTML('afterbegin', `
          <tr class="hover:bg-gray-50">
            <td class="px-4 py-3">${item.name} ${item.family}</td>
            <td class="px-4 py-3 font-mono">${item.UID}</td>
            <td class="px-4 py-3">${item.formated_enter_time}</td>
            <td class="px-4 py-3">${item.formated_duration}</td>
          </tr>
        `);
      });
    })
    .catch(console.error);
};

// ----- Submit Admin Settings -----
const setAdminSettings = (event) => {
  event.preventDefault();
  const inputs = event.target.closest('.form').querySelectorAll("input");
  const [capacity, eachPersonTime] = inputs;

  const dataToSend = {
    capacity: capacity.value,
    each_person_time: eachPersonTime.value,
    highest_settlement_time: eachPersonTime.value,
  };

  fetch(`${API_URL}/set_admin_settings/`, {
    method: 'POST',
    body: JSON.stringify(dataToSend),
  })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(() => {
      showToast("تنظیمات با موفقیت انجام شد", "success");
    })
    .catch(() => {
      showToast("خطای سیستمی", "error");
    });
};

// ----- Submit Guest Info -----
const setGuest = (event) => {
  event.preventDefault();
  const inputs = event.target.closest('.form').querySelectorAll("input");
  const [nameInput, familyInput, UIDInput] = inputs;

  const dataToSend = {
    name: nameInput.value,
    family: familyInput.value,
    UID: UIDInput.value,
  };

  fetch(`${API_URL}/set_guest/`, {
    method: 'POST',
    body: JSON.stringify(dataToSend),
  })
    .then(response => {
      if (!response.ok) throw { status: response.status };
      return response.json();
    })
    .then(data => {
      if (data.status === "created") showToast("زائر با موفقیت ثبت شد", "success");
      else if (data.status === "created before") showToast("این زائر از قبل موجود است", "error");
    })
    .catch(error => {
      if (error.status === 400) showToast("لطفاً تمام فیلدها را پر کنید", "error");
      else showToast("خطای سیستمی", "error");
    });
};

// ----- Submit Exit -----
const setExit = (event) => {
  event.preventDefault();
  const UIDInput = event.target.closest('.form').querySelector("input");

  const dataToSend = { UID: UIDInput.value };

  fetch(`${API_URL}/set_exit/`, {
    method: 'POST',
    body: JSON.stringify(dataToSend),
  })
    .then(response => {
      if (!response.ok) throw { status: response.status };
      return response.json();
    })
    .then(data => {
      if (data.status === "there is no such person") {
        showToast("زائری با این شماره اختصاصی موجود نیست", "error");
      } else if (data.status === "person removed") {
        showToast("زائر با موفقیت حذف شد", "success");
        users = users.filter(item => item.UID !== Number(dataToSend.UID));
        const tableBody = $.querySelector('.activeGuestsTable tbody');
        tableBody.innerHTML = "";
        users.forEach(item => {
          tableBody.insertAdjacentHTML('afterbegin', `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">${item.name} ${item.family}</td>
              <td class="px-4 py-3 font-mono">${item.UID}</td>
              <td class="px-4 py-3">${item.formated_enter_time}</td>
              <td class="px-4 py-3">${item.formated_duration}</td>
            </tr>
          `);
        });
      }
    })
    .catch(error => {
      if (error.status === 400) showToast("شماره اختصاصی وارد نشده یا نامعتبر است", "error");
      else showToast("خطای سیستمی", "error");
    });
};

// ----- Fetch Exit Page Data -----
const fetchExitData = () => {
  fetch(`${API_URL}/exit_page/`)
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    })
    .then(data => {
      $.querySelector('.percent').innerHTML = `درصد اشغال: %${Math.round(data.percent)} (${data.active_guests}/${data.capactiy})`;
      $.querySelector('.highest-settlement-time').innerHTML = `${data.highest_settlement_time} ساعت`;

      if (data.completed_95) {
        const inviteExit = $.querySelector('.invite-exit');
        inviteExit.innerHTML = `
          <table class="activeGuestsTable w-full text-sm text-right">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-3 text-right">نام کامل</th>
                <th class="px-4 py-3 text-right">شماره اختصاصی</th>
                <th class="px-4 py-3 text-right">زمان ورود</th>
                <th class="px-4 py-3 text-right">مدت اقامت</th>
              </tr>
            </thead>
            <tbody class="body divide-y divide-gray-200"></tbody>
          </table>
        `;
        data.users.forEach(item => {
          inviteExit.querySelector("tbody").insertAdjacentHTML('afterbegin', `
            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">${item.name} ${item.family}</td>
              <td class="px-4 py-3 font-mono">${item.UID}</td>
              <td class="px-4 py-3 font-mono">${item.formated_enter_time}</td>
              <td class="px-4 py-3 font-mono">${item.formated_duration}</td>
            </tr>
          `);
        });
      }
    })
    .catch(console.error);
};

// ----- Event Listeners -----
exitButton.addEventListener("click", () => {
  exitPage.style.display = "block";
  setExitPage.style.display = "none";
  signupPage.style.display = "none";
  adminpanelPage.style.display = "none";
  fetchExitData();
});

setExitButton.addEventListener("click", () => {
  exitPage.style.display = "none";
  setExitPage.style.display = "block";
  signupPage.style.display = "none";
  adminpanelPage.style.display = "none";
  fetchSetExitData();
});

adminpanelButton.addEventListener("click", () => {
  exitPage.style.display = "none";
  setExitPage.style.display = "none";
  signupPage.style.display = "none";
  adminpanelPage.style.display = "block";
  fetchAdminSettingsData();
});

signupButton.addEventListener("click", () => {
  exitPage.style.display = "none";
  setExitPage.style.display = "none";
  signupPage.style.display = "block";
  adminpanelPage.style.display = "none";
});

// ---- Initial Fetch ----
fetchAdminSettingsData();
