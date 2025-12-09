interface WorkingStatusBadgeProps {
  status: string | undefined;
}

export const WorkingStatusBadge = ({ status }: WorkingStatusBadgeProps) => {
  const getStatusConfig = (status?: string) => {
    const normalizedStatus = (status || 'PENDING').toUpperCase();
    
    switch (normalizedStatus) {
      case 'YES':
      case 'PASS':
      case 'PASSED':
      case 'TRUE':
        return {
          bg: 'bg-green-100',
          text: 'text-green-800',
          border: 'border-green-200',
          icon: 'fas fa-check-circle',
          label: 'PASS',
        };
      case 'NO':
      case 'FAIL':
      case 'FAILED':
      case 'FALSE':
        return {
          bg: 'bg-red-100',
          text: 'text-red-800',
          border: 'border-red-200',
          icon: 'fas fa-times-circle',
          label: 'FAIL',
        };
      case 'PENDING':
        return {
          bg: 'bg-yellow-100',
          text: 'text-yellow-800',
          border: 'border-yellow-200',
          icon: 'fas fa-clock',
          label: 'PENDING',
        };
      default:
        return {
          bg: 'bg-gray-100',
          text: 'text-gray-800',
          border: 'border-gray-200',
          icon: 'fas fa-question-circle',
          label: normalizedStatus || 'UNKNOWN',
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold border ${config.bg} ${config.text} ${config.border}`}
    >
      <i className={`${config.icon} mr-1`}></i>
      {config.label}
    </span>
  );
};

export default WorkingStatusBadge;

