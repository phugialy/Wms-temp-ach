
interface ProgressModalProps {
  isOpen: boolean;
  progress: number;
  currentStep: number;
  totalSteps?: number;
  onClose: () => void;
  stepNames?: string[];
  stepIcons?: string[];
}

export const ProgressModal = ({
  isOpen,
  progress,
  currentStep,
  totalSteps = 3,
  onClose,
  stepNames = ['Preparing Items', 'Adding to Inventory', 'Complete'],
  stepIcons = ['📦', '⚡', '✅'],
}: ProgressModalProps) => {
  if (!isOpen) return null;

  const getStepName = (step: number) => {
    return stepNames[step - 1] || 'Processing';
  };

  const getStepIcon = (step: number) => {
    return stepIcons[step - 1] || '⏳';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <div className="text-4xl mb-4">{getStepIcon(currentStep)}</div>
          <h3 className="text-xl font-semibold mb-4">Processing Items</h3>
          <p className="text-gray-600 mb-6">{getStepName(currentStep)}</p>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-3 mb-4">
            <div
              className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            ></div>
          </div>

          <p className="text-sm text-gray-500 mb-4">{progress.toFixed(0)}% Complete</p>

          {currentStep === totalSteps && progress >= 100 && (
            <div className="mt-4">
              <button
                onClick={onClose}
                className="bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 transition-colors"
              >
                ✅ Complete
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;

