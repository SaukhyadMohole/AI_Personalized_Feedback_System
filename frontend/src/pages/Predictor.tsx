import { useEffect, useState } from 'react';
import { apiClient, PredictResponse, Student } from '../api';

const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;

const probabilityColor = (probability: number, threshold: number) => {
  if (probability >= threshold + 0.1) {
    return 'text-green-700';
  }
  if (Math.abs(probability - threshold) <= 0.05) {
    return 'text-orange-600';
  }
  if (probability < 0.2) {
    return 'text-red-700';
  }
  return 'text-gray-900';
};

function Predictor() {
  const [formData, setFormData] = useState({
    attendance: '',
    marks: '',
    internal_score: '',
    final_exam_score: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PredictResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simulatedProb, setSimulatedProb] = useState<number | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<number | ''>('');
  const [studentsLoading, setStudentsLoading] = useState(false);

  useEffect(() => {
    const fetchStudents = async () => {
      setStudentsLoading(true);
      try {
        const response = await apiClient.getStudents(1, 100);
        setStudents(response.items);
      } catch (err) {
        console.warn('Failed to load students for predictor', err);
      } finally {
        setStudentsLoading(false);
      }
    };

    fetchStudents();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    const attendance = parseFloat(formData.attendance);
    const marks = parseFloat(formData.marks);
    const internal_score = parseFloat(formData.internal_score);

    if (isNaN(attendance) || attendance < 0 || attendance > 100) {
      setError('Attendance must be between 0 and 100');
      return false;
    }
    if (isNaN(marks) || marks < 0 || marks > 100) {
      setError('Marks must be between 0 and 100');
      return false;
    }
    if (isNaN(internal_score) || internal_score < 0 || internal_score > 100) {
      setError('Internal score must be between 0 and 100');
      return false;
    }
    if (formData.final_exam_score) {
      const final_exam_score = parseFloat(formData.final_exam_score);
      if (isNaN(final_exam_score) || final_exam_score < 0 || final_exam_score > 100) {
        setError('Final exam score must be between 0 and 100');
        return false;
      }
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.predict({
        student_id: selectedStudentId === '' ? undefined : Number(selectedStudentId),
        attendance: parseFloat(formData.attendance),
        marks: parseFloat(formData.marks),
        internal_score: parseFloat(formData.internal_score),
        final_exam_score: formData.final_exam_score
          ? parseFloat(formData.final_exam_score)
          : undefined,
      });
      setResult(response);
      setSimulatedProb(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const renderResult = (prediction: PredictResponse) => {
    const baseProb = simulatedProb ?? prediction.probability;
    const nearThreshold = Math.abs(baseProb - prediction.threshold_used) <= 0.05;
    const textColor = probabilityColor(baseProb, prediction.threshold_used);
    const passPrediction = (simulatedProb ?? prediction.probability) >= prediction.threshold_used;
    const margin = baseProb - prediction.threshold_used;
    const confidenceLabel = (() => {
      if (passPrediction) {
        if (margin >= 0.2) return 'High confidence in PASS (well above threshold).';
        if (margin >= 0.1) return 'Moderate confidence in PASS.';
        if (margin >= 0) return 'Low confidence: just over the threshold.';
        return 'Prediction below threshold.';
      }

      if (prediction.probability <= 0.2) return 'High confidence in FAIL (probability very low).';
      if (prediction.probability <= prediction.threshold_used - 0.1) return 'Moderate confidence in FAIL.';
      return 'Low confidence: close to threshold.';
    })();

    return (
      <div className="mt-6 p-4 bg-indigo-50 border border-indigo-200 rounded-md space-y-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Prediction Result</h3>
          <div className="space-y-2">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700">Predicted Result: </span>
              <span
                className={`ml-2 px-2 py-1 rounded text-sm font-semibold ${
                  passPrediction ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}
              >
                {passPrediction ? 'PASS' : 'FAIL'}
              </span>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
              <span className="text-sm font-medium text-gray-700">Probability of Passing:</span>
              <span className={`text-sm font-semibold ${textColor}`}>
                {formatPercentage(baseProb)}
              </span>
            </div>
            <div className="text-xs text-gray-600">
              Decision threshold: <span className="font-mono">{formatPercentage(prediction.threshold_used)}</span>
            </div>
            <div className="text-sm text-gray-700">{confidenceLabel}</div>
          </div>
        </div>

        {nearThreshold && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
            Probability is close to the decision threshold. Consider reviewing additional context before finalizing.
          </div>
        )}

        {prediction.suspicious_input && (
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800 space-y-1">
            <p className="font-semibold">Suspicious input detected:</p>
            {prediction.suspicious_reasons?.map((reason, idx) => (
              <p key={idx}>• {reason}</p>
            ))}
          </div>
        )}

        <div className="bg-white border border-indigo-200 rounded-md p-4">
          <h4 className="text-sm font-semibold text-gray-900 mb-2">Explanation</h4>
          <div className="space-y-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Top Reasons</p>
              <ul className="space-y-1">
                {prediction.explanation.top_reasons.map((reason, idx) => (
                  <li key={idx} className="text-sm text-gray-700">
                    <span className="font-medium text-gray-900">{reason.feature}</span>{' '}
                    {reason.effect === 'increase'
                      ? 'increased'
                      : reason.effect === 'decrease'
                      ? 'decreased'
                      : 'did not change'}{' '}
                    the pass probability (contribution {reason.contribution.toFixed(2)}).
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wide text-gray-500 mb-1">Feature Importance</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
                {Object.entries(prediction.explanation.feature_importances).map(([feature, importance]) => (
                  <div
                    key={feature}
                    className="bg-indigo-100 text-indigo-800 rounded px-2 py-1 flex items-center justify-between"
                  >
                    <span className="font-medium">{feature}</span>
                    <span>{(importance * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderFeedback = (prediction: PredictResponse) => {
    if (!prediction.feedback || prediction.feedback.length === 0) return null;

    const title = prediction.predicted_result === 1
      ? 'Feedback & Improvements (increase confidence)'
      : 'Feedback & Improvements (raise pass probability)';

    const gainColor = (gain: number) => {
      if (gain >= 0.10) return 'text-green-700';
      if (gain >= 0.05) return 'text-orange-600';
      return 'text-gray-700';
    };

    return (
      <div className="mt-4 p-4 bg-white border border-gray-200 rounded-md">
        <h4 className="text-md font-semibold text-gray-900 mb-3">{title}</h4>
        {prediction.feedback_paragraph && (
          <p className="text-sm text-gray-800 mb-4 leading-6">{prediction.feedback_paragraph}</p>
        )}
        <div className="space-y-3">
          {prediction.feedback.map((s, idx) => (
            <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b last:border-b-0 pb-2">
              <div className="space-y-1">
                <div className="text-sm font-medium text-gray-900">
                  {s.feature}: {s.suggested_change}
                </div>
                <div className="text-xs text-gray-600">{s.explanation}</div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-sm">
                  <span className={`font-semibold ${gainColor(s.estimated_probability_gain)}`}>
                    +{formatPercentage(s.estimated_probability_gain)}
                  </span>
                  <span className="text-gray-500"> → {formatPercentage(s.new_probability_estimate)}</span>
                </div>
                <button
                  type="button"
                  className="px-3 py-1 text-xs rounded bg-indigo-600 text-white hover:bg-indigo-700"
                  onClick={() => setSimulatedProb(s.new_probability_estimate)}
                  title="Simulate suggestion"
                >
                  Simulate
                </button>
              </div>
            </div>
          ))}
        </div>
        {prediction.notes && (
          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
            {prediction.notes}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Predictor</h2>

        <div className="bg-white shadow rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="student_id" className="block text-sm font-medium text-gray-700">
                Student (optional)
              </label>
              <select
                id="student_id"
                value={selectedStudentId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedStudentId(value ? Number(value) : '');
                }}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                disabled={studentsLoading || students.length === 0}
              >
                <option value="">Select student</option>
                {students.map((student) => (
                  <option key={student.student_id} value={student.student_id}>
                    {student.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="attendance" className="block text-sm font-medium text-gray-700">
                Attendance (%) *
              </label>
              <input
                type="number"
                id="attendance"
                name="attendance"
                min="0"
                max="100"
                step="0.1"
                required
                value={formData.attendance}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="marks" className="block text-sm font-medium text-gray-700">
                Marks (%) *
              </label>
              <input
                type="number"
                id="marks"
                name="marks"
                min="0"
                max="100"
                step="0.1"
                required
                value={formData.marks}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="internal_score" className="block text-sm font-medium text-gray-700">
                Internal Score (%) *
              </label>
              <input
                type="number"
                id="internal_score"
                name="internal_score"
                min="0"
                max="100"
                step="0.1"
                required
                value={formData.internal_score}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <label htmlFor="final_exam_score" className="block text-sm font-medium text-gray-700">
                Final Exam Score (%) (Optional)
              </label>
              <input
                type="number"
                id="final_exam_score"
                name="final_exam_score"
                min="0"
                max="100"
                step="0.1"
                value={formData.final_exam_score}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {loading ? 'Predicting...' : 'Predict'}
              </button>
            </div>
          </form>

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {result && (
            <>
              {renderResult(result)}
              {renderFeedback(result)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Predictor;

