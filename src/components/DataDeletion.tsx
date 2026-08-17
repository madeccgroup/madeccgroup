import React, { useState } from 'react';

interface DataDeletionProps {
  setCurrentTab: (tab: string) => void;
}

export default function DataDeletion({ setCurrentTab }: DataDeletionProps) {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim()) {
      setError('Please enter your email address.');
      return;
    }

    try {
      const response = await fetch('/api/contact/data-deletion', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          requestType: 'data_deletion',
        }),
      });

      if (!response.ok) {
        throw new Error('Request could not be submitted.');
      }

      setSubmitted(true);
      setEmail('');
    } catch (err) {
      console.error('Data deletion request failed:', err);
      setError(
        'We could not submit your request online. Please contact us directly at madecccons@gmail.com.'
      );
    }
  };

  return (
    <section className="min-h-screen py-16 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="mb-12">
          <div className="inline-flex items-center px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-xs font-semibold uppercase tracking-wider mb-4">
            Data Privacy &amp; Deletion
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-5">
            MADECC Group Data Deletion
          </h1>

          <p className="text-lg leading-8 text-slate-600 dark:text-slate-300 max-w-3xl">
            MADECC Group respects your privacy and provides users with a clear
            process for requesting deletion of personal information associated
            with their account or use of our services.
          </p>
        </div>

        {/* Main content */}
        <div className="space-y-8">

          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-4">
              How to request deletion of your data
            </h2>

            <p className="leading-7 text-slate-600 dark:text-slate-300 mb-4">
              If you have connected a social media account, including a TikTok,
              Facebook, Instagram, YouTube, LinkedIn, X/Twitter, or WhatsApp
              account to MADECC Group, you may request deletion of the personal
              information associated with that connection.
            </p>

            <p className="leading-7 text-slate-600 dark:text-slate-300">
              Submit the email address associated with your MADECC Group
              account or social media connection using the form below. Our
              team will review the request and take the appropriate steps to
              delete eligible personal information.
            </p>
          </div>

          {/* Request form */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-2">
              Submit a Data Deletion Request
            </h2>

            <p className="text-sm leading-6 text-slate-500 dark:text-slate-400 mb-6">
              Please provide the email address associated with your account or
              social media connection.
            </p>

            {submitted ? (
              <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-5">
                <h3 className="font-semibold text-green-800 dark:text-green-300 mb-2">
                  Request received
                </h3>

                <p className="text-sm leading-6 text-green-700 dark:text-green-400">
                  Your data deletion request has been submitted. MADECC Group
                  will review the request and contact you if additional
                  information is required.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="deletion-email"
                    className="block text-sm font-semibold mb-2"
                  >
                    Email address
                  </label>

                  <input
                    id="deletion-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-4 py-3 outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                {error && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 p-4 text-sm text-red-700 dark:text-red-400">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full sm:w-auto rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-semibold px-6 py-3 transition-colors"
                >
                  Submit Deletion Request
                </button>
              </form>
            )}
          </div>

          {/* What gets deleted */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-4">
              What information may be deleted?
            </h2>

            <ul className="space-y-3 text-slate-600 dark:text-slate-300">
              <li>
                • Personal information associated with your MADECC Group
                account, where applicable.
              </li>
              <li>
                • Social-media connection information and authorization
                records associated with your account.
              </li>
              <li>
                • Stored profile information obtained through an authorized
                social-media integration, where applicable.
              </li>
              <li>
                • Other personal information that is no longer required for
                legitimate business, legal, security, or regulatory purposes.
              </li>
            </ul>
          </div>

          {/* Exceptions */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-4">
              Information that may need to be retained
            </h2>

            <p className="leading-7 text-slate-600 dark:text-slate-300">
              Certain information may need to be retained where required by
              applicable law, legitimate security requirements, financial
              recordkeeping obligations, dispute resolution, fraud prevention,
              or other legally permitted purposes. Where retention is
              required, the information will be retained only for the period
              necessary for that purpose.
            </p>
          </div>

          {/* Processing */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 p-6 sm:p-8 bg-white dark:bg-slate-900">
            <h2 className="text-2xl font-bold mb-4">
              Processing of your request
            </h2>

            <p className="leading-7 text-slate-600 dark:text-slate-300">
              MADECC Group will review deletion requests and may request
              reasonable information to verify the identity of the requester
              before processing the request. Once verified, eligible personal
              information will be deleted or anonymized in accordance with our
              applicable privacy practices and legal obligations.
            </p>
          </div>

          {/* Contact */}
          <div className="rounded-2xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/20 p-6 sm:p-8">
            <h2 className="text-2xl font-bold mb-4">
              Alternative deletion request method
            </h2>

            <p className="leading-7 text-slate-700 dark:text-slate-300 mb-4">
              If you cannot use the online form, you can submit a data deletion
              request directly to MADECC Group.
            </p>

            <p className="font-semibold">
              Email:{' '}
              <a
                href="mailto:madecccons@gmail.com"
                className="text-amber-700 dark:text-amber-400 hover:underline"
              >
                madecccons@gmail.com
              </a>
            </p>

            <p className="font-semibold mt-2">
              Website:{' '}
              <a
                href="https://madeccgroup.online"
                className="text-amber-700 dark:text-amber-400 hover:underline"
              >
                madeccgroup.online
              </a>
            </p>
          </div>

          {/* Legal links */}
          <div className="flex flex-wrap gap-4 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setCurrentTab('privacy')}
              className="text-sm font-semibold hover:text-amber-500"
            >
              Privacy Policy
            </button>

            <button
              onClick={() => setCurrentTab('terms')}
              className="text-sm font-semibold hover:text-amber-500"
            >
              Terms of Service
            </button>

            <button
              onClick={() => setCurrentTab('home')}
              className="text-sm font-semibold hover:text-amber-500"
            >
              Back to MADECC Group
            </button>
          </div>

        </div>
      </div>
    </section>
  );
}
