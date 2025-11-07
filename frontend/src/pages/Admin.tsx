import { useState, useEffect } from 'react';
import { apiClient, RetrainResponse, UpdateThresholdResponse } from '../api';

function Admin() {
  const [token, setToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [retrainLoading, setRetrainLoading] = useState(false);
  const [retrainResult, setRetrainResult] = useState<RetrainResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exportLoading, setExportLoading] = useState(false);
  const [thresholdInfo, setThresholdInfo] = useState<UpdateThresholdResponse | null>(null);
  const [thresholdInput, setThresholdInput] = useState('0.6');
  const [thresholdSaving, setThresholdSaving] = useState(false);
  const [thresholdMessage, setThresholdMessage] = useState<string | null>(null);

  useEffect(() => {
    // Check if token exists in localStorage
    const savedToken = localStorage.getItem('admin_token');
    if (savedToken) {
      setToken(savedToken);
      setIsAuthenticated(true);
    }
  }, []);

  useEffect(() => {
    const fetchThreshold = async () => {
      try {
        const info = await apiClient.getThreshold();
        setThresholdInfo(info);
        setThresholdInput(info.threshold.toFixed(2));
      } catch (err) {
        console.error(err);
      }
    };

    if (isAuthenticated) {
      fetchThreshold();
    } else {
      setThresholdInfo(null);
    }
  }, [isAuthenticated]);

  const handleLogin = () => {
    if (!token.trim()) {
      setError('Please enter a token');
      return;
    }
    localStorage.setItem('admin_token', token);
    setIsAuthenticated(true);
    setError(null);
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken('');
    setIsAuthenticated(false);
    setRetrainResult(null);
    setThresholdInfo(null);
  };

  const handleRetrain = async () => {
    setRetrainLoading(true);
    setError(null);
    setRetrainResult(null);
    try {
      const response = await apiClient.retrain();
      setRetrainResult(response);
      const appliedThreshold = response.user_threshold ?? response.recommended_threshold;
      setThresholdInfo({ threshold: appliedThreshold, source: response.user_threshold ? 'metadata:user' : 'metadata:recommended' });
      setThresholdInput(appliedThreshold.toFixed(2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to retrain model');
    } finally {
      setRetrainLoading(false);
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    setError(null);
    try {
      const blob = await apiClient.exportData();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'student_data_export.csv';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to export data');
    } finally {
      setExportLoading(false);
    }
  };

  const handleThresholdSave = async () => {
    const parsed = parseFloat(thresholdInput);
    if (Number.isNaN(parsed) || parsed <= 0 || parsed >= 1) {
      setThresholdMessage('Threshold must be a decimal between 0 and 1 (e.g., 0.60).');
      return;
    }

    setThresholdSaving(true);
    setThresholdMessage(null);
    try {
      const response = await apiClient.updateThreshold(parsed);
      setThresholdInfo(response);
      setThresholdMessage('Threshold updated successfully.');
    } catch (err) {
      setThresholdMessage(err instanceof Error ? err.message : 'Failed to update threshold.');
    } finally {
      setThresholdSaving(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="max-w-md mx-auto">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Admin Login</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="token" className="block text-sm font-medium text-gray-700">
                  Admin Token
                </label>
                <input
                  type="password"
                  id="token"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleLogin()}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  placeholder="Enter admin token"
                />
              </div>
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              <button
                onClick={handleLogin}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Login
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Admin Panel</h2>
          <button
            onClick={handleLogout}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700"
          >
            Logout
          </button>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="space-y-6">
          {/* Retrain Model */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Retrain Model</h3>
            <p className="text-sm text-gray-600 mb-4">
              Retrain the ML model using data from the enrollments table.
            </p>
            <button
              onClick={handleRetrain}
              disabled={retrainLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {retrainLoading ? 'Training...' : 'Retrain Model'}
            </button>

            {retrainResult && (
              <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-md">
                <h4 className="font-semibold text-gray-900 mb-2">Training Results</h4>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-medium">Accuracy: </span>
                    <span>{(retrainResult.accuracy * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Precision: </span>
                    <span>{(retrainResult.precision * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Recall: </span>
                    <span>{(retrainResult.recall * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="font-medium">F1 Score: </span>
                    <span>{(retrainResult.f1_score * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="font-medium">ROC AUC: </span>
                    <span>{(retrainResult.roc_auc * 100).toFixed(2)}%</span>
                  </div>
                  <div>
                    <span className="font-medium">Samples Used: </span>
                    <span>{retrainResult.samples_used}</span>
                  </div>
                  <div>
                    <span className="font-medium">Model Path: </span>
                    <span className="font-mono text-xs">{retrainResult.model_path}</span>
                  </div>
                  <div>
                    <span className="font-medium">Timestamp: </span>
                    <span>{new Date(retrainResult.timestamp).toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="font-medium">Recommended Threshold: </span>
                    <span>{retrainResult.recommended_threshold.toFixed(2)}</span>
                  </div>
                  {typeof retrainResult.user_threshold === 'number' && (
                    <div>
                      <span className="font-medium">Saved Threshold: </span>
                      <span>{retrainResult.user_threshold.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Decision Threshold */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Decision Threshold</h3>
            <p className="text-sm text-gray-600 mb-4">
              Control the probability threshold used to classify a student as pass. A higher threshold reduces false positives.
            </p>
            <div className="space-y-3">
              <div>
                <label htmlFor="threshold" className="block text-sm font-medium text-gray-700">
                  Threshold (0 &lt; value &lt; 1)
                </label>
                <input
                  id="threshold"
                  type="number"
                  step="0.01"
                  min="0.01"
                  max="0.99"
                  value={thresholdInput}
                  onChange={(e) => setThresholdInput(e.target.value)}
                  className="mt-1 block w-32 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                />
                {thresholdInfo && (
                  <p className="mt-2 text-xs text-gray-500">
                    Current applied threshold: <span className="font-semibold">{thresholdInfo.threshold.toFixed(2)}</span>{' '}
                    (source: {thresholdInfo.source})
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleThresholdSave}
                  disabled={thresholdSaving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {thresholdSaving ? 'Saving...' : 'Save Threshold'}
                </button>
                <button
                  type="button"
                  className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
                  onClick={() => {
                    const value = retrainResult?.recommended_threshold ?? 0.6;
                    setThresholdInput(value.toFixed(2));
                  }}
                >
                  Use recommended ({(retrainResult?.recommended_threshold ?? 0.6).toFixed(2)})
                </button>
              </div>
              {thresholdMessage && (
                <div className="text-sm text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-md px-3 py-2">
                  {thresholdMessage}
                </div>
              )}
            </div>
          </div>

          {/* Export Data */}
          <div className="bg-white shadow rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>
            <p className="text-sm text-gray-600 mb-4">
              Export training-ready CSV from the current database.
            </p>
            <button
              onClick={handleExport}
              disabled={exportLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {exportLoading ? 'Exporting...' : 'Export CSV'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Admin;

