import React from 'react';
import './RaiseRequestForm.css';

export type NewRequestInput = {
  title: string;
  prLink: string;
  branch: string;
  changeType: string;
  description: string;
};

const emptyForm: NewRequestInput = {
  title: '',
  prLink: '',
  branch: '',
  changeType: '',
  description: '',
};

const CHANGE_TYPES = ['major', 'minor', 'patch', 'env-change'] as const;

export const RaiseRequestForm = ({
  apiName,
  requestedBy,
  onSubmit,
  onCancel,
}: {
  apiName: string;
  requestedBy: string;
  onSubmit: (input: NewRequestInput) => void;
  onCancel: () => void;
}) => {
  const [form, setForm] = React.useState<NewRequestInput>(emptyForm);

  // single value-based setter, no event types to wrestle with
  const setField = (field: keyof NewRequestInput, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const titleEmpty = form.title.trim() === '';
  const prInvalid = !/^https?:\/\//.test(form.prLink.trim());
  const branchEmpty = form.branch.trim() === '';
  const changeTypeEmpty = form.changeType === '';

  const isValid =
    !titleEmpty && !prInvalid && !branchEmpty && !changeTypeEmpty;

  const titleShowError = form.title !== '' && titleEmpty;
  const prShowError = form.prLink !== '' && prInvalid;
  const branchShowError = form.branch !== '' && branchEmpty;

  return (
    <div className="request-card">
      <div className="request-header">
        <h2>Raise production request</h2>
        <p>
          For <strong>{apiName}</strong> · submitting as{' '}
          <strong>{requestedBy}</strong>
        </p>
      </div>

      <div className="request-divider" />

      <div className="request-form">
        <div className="form-field">
          <label>
            Title <span>*</span>
          </label>
          <input
            value={form.title}
            onChange={e => setField('title', e.target.value)}
            placeholder="Short summary of what you're shipping"
          />
          {titleShowError && (
            <small className="error">Title is required</small>
          )}
        </div>

        <div className="form-field">
          <label>
            PR link <span>*</span>
          </label>
          <input
            value={form.prLink}
            onChange={e => setField('prLink', e.target.value)}
            placeholder="https://gitlab.com/group/project/-/merge_requests/123"
          />
          {prShowError && (
            <small className="error">Must start with http(s)://</small>
          )}
        </div>

        <div className="form-field">
          <label>
            Branch <span>*</span>
          </label>
          <input
            value={form.branch}
            onChange={e => setField('branch', e.target.value)}
            placeholder="feature/chat-streaming"
          />
          {branchShowError && (
            <small className="error">Branch is required</small>
          )}
        </div>

        <div className="form-field">
          <label>
            Change type <span>*</span>
          </label>
          <select
            value={form.changeType}
            onChange={e => setField('changeType', e.target.value)}
          >
            <option value="" disabled>
              Select change type…
            </option>
            {CHANGE_TYPES.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={e => setField('description', e.target.value)}
            placeholder="Optional context for approvers (becomes the GitLab issue body)"
            rows={4}
          />
        </div>
      </div>

      <div className="request-actions">
        <button className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          className="submit-btn"
          disabled={!isValid}
          onClick={() => onSubmit(form)}
        >
          Submit request
        </button>
      </div>
    </div>
  );
};