module.exports = ({ config }) => {
  return {
    ...config,
    extra: {
      ...config.extra,
      eas: {
        projectId: process.env.EAS_WORKER_PROJECT_ID || process.env.EAS_PROJECT_ID || config.extra?.eas?.projectId || undefined,
      },
    },
  };
};
