const API_URL_COMPLAINT =
  'https://script.google.com/macros/s/AKfycbxY0TPyoSAOTACaDzjOAwI4y3Fo5Movlx5G6hhROxNBHUpx7cZSRctCRaWNtd1iw4U6/exec';

document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const form = $('customerComplaintForm');
  const repSelect = $('receivedFrom');
  const customerSelect = $('complaintCustomer');
  const message = $('complaintMessage');
  const saveButton = $('saveComplaintBtn');

  if (!form || !repSelect || !customerSelect) return;

  const today = new Date();
  const localToday = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  ).toISOString().slice(0, 10);

  $('complaintDate').value = localToday;
  $('receivedDate').value = localToday;

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

    function showMessage(text, type) {
    message.textContent = text;
    message.className = `form-message ${type}`;

    setTimeout(() => {
      message.textContent = '';
      message.className = 'form-message';
    }, 5000);
  }

  async function loadDropdowns() {
    try {
      const response = await fetch(
        `${API_URL_COMPLAINT}?action=getCustomerComplaintLists`
      );
      const result = await response.json();

      if (!result.success) throw new Error(result.error || 'Could not load lists.');

      repSelect.innerHTML =
        '<option value="">Select rep</option>' +
        (result.reps || []).map(rep =>
          `<option value="${escapeHtml(rep)}">${escapeHtml(rep)}</option>`
        ).join('');

      customerSelect.innerHTML =
        '<option value="">Select customer</option>' +
        (result.customers || []).map(customer =>
          `<option value="${escapeHtml(customer)}">${escapeHtml(customer)}</option>`
        ).join('');
    } catch (error) {
      repSelect.innerHTML = '<option value="">Could not load reps</option>';
      customerSelect.innerHTML = '<option value="">Could not load customers</option>';
      showMessage(error.message || 'Could not load dropdowns.', 'error');
    }
  }

  loadDropdowns();

  form.addEventListener('submit', event => {
    event.preventDefault();

    const data = {
      action: 'saveCustomerComplaint',
      date: $('complaintDate').value,
      receivedDate: $('receivedDate').value,
      receivedFrom: repSelect.value,
      customer: customerSelect.value,
      customerComplaint: $('customerComplaint').value.trim(),
      itemQty: $('itemQty').value,
      complaintCategory: $('complaintCategory').value,
      complaintSampleCcSheet: $('statusSampleCc').value,
      complaintSample: $('statusSample').value,
      complaintOnly: $('statusComplaint').value
    };

    const previewDate = value =>
      value ? value.split('-').reverse().join('-') : '—';

    showPreviewModal({
      title: 'Confirm Save — Customer Complaint',
      subtitle: 'Please review the complaint details before saving',
      meta: [
        { label: 'Date', value: previewDate(data.date) },
        { label: 'Received Date', value: previewDate(data.receivedDate) }
      ],
      sections: [
        {
          title: 'Complaint Details',
          fields: [
            { label: 'Received From', value: data.receivedFrom },
            { label: 'Complaint Category', value: data.complaintCategory },
            { label: 'Customer', value: data.customer },
            { label: 'Customer Complaint', value: data.customerComplaint },
            { label: 'Item QTY (kg)', value: data.itemQty }
          ]
        },
        {
          title: 'Complaint Status',
          fields: [
            { label: 'Complaint + sample + CC sheet', value: data.complaintSampleCcSheet },
            { label: 'Complaint + sample', value: data.complaintSample },
            { label: 'Complaint', value: data.complaintOnly }
          ]
        }
      ],
      onConfirm: () => saveComplaint(data)
    });
  });

  async function saveComplaint(data) {
    message.textContent = '';
    message.className = 'form-message';
    saveButton.disabled = true;
    saveButton.textContent = 'Saving...';

    try {
      const response = await fetch(API_URL_COMPLAINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify(data)
      });

      const result = await response.json();
      if (!result.success) throw new Error(result.error || 'Save failed.');

      InputFeedback.success('Data saved successfully.');
      form.reset();
      $('complaintDate').value = localToday;
      $('receivedDate').value = localToday;
    } catch (error) {
      showMessage('❌ ' + (error.message || 'Save failed. Please try again.'), 'error');
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = 'Save';
    }
  }
});