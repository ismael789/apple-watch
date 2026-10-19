/* eslint-env node */

const fs = require('fs');
const path = require('path');
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
} = require('expo/config-plugins');

const LEGACY_RULES = `<?xml version="1.0" encoding="utf-8"?>
<full-backup-content>
  <exclude domain="root" path="." />
  <exclude domain="file" path="." />
  <exclude domain="database" path="." />
  <exclude domain="sharedpref" path="." />
  <exclude domain="external" path="." />
  <exclude domain="device_root" path="." />
  <exclude domain="device_file" path="." />
  <exclude domain="device_database" path="." />
  <exclude domain="device_sharedpref" path="." />
</full-backup-content>
`;

const MODERN_RULES = `<?xml version="1.0" encoding="utf-8"?>
<data-extraction-rules>
  <cloud-backup>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
    <exclude domain="device_root" path="." />
    <exclude domain="device_file" path="." />
    <exclude domain="device_database" path="." />
    <exclude domain="device_sharedpref" path="." />
  </cloud-backup>
  <device-transfer>
    <exclude domain="root" path="." />
    <exclude domain="file" path="." />
    <exclude domain="database" path="." />
    <exclude domain="sharedpref" path="." />
    <exclude domain="external" path="." />
    <exclude domain="device_root" path="." />
    <exclude domain="device_file" path="." />
    <exclude domain="device_database" path="." />
    <exclude domain="device_sharedpref" path="." />
  </device-transfer>
</data-extraction-rules>
`;

const withNoDataRestore = config => {
  let next = withAndroidManifest(config, manifestConfig => {
    const application = AndroidConfig.Manifest.getMainApplicationOrThrow(
      manifestConfig.modResults,
    );
    application.$['android:allowBackup'] = 'false';
    application.$['android:fullBackupContent'] = '@xml/watch_backup_rules';
    application.$['android:dataExtractionRules'] =
      '@xml/watch_data_extraction_rules';
    return manifestConfig;
  });

  next = withDangerousMod(next, [
    'android',
    async modConfig => {
      const resourceDirectory = path.join(
        modConfig.modRequest.platformProjectRoot,
        'app',
        'src',
        'main',
        'res',
        'xml',
      );
      await fs.promises.mkdir(resourceDirectory, { recursive: true });
      await Promise.all([
        fs.promises.writeFile(
          path.join(resourceDirectory, 'watch_backup_rules.xml'),
          LEGACY_RULES,
        ),
        fs.promises.writeFile(
          path.join(resourceDirectory, 'watch_data_extraction_rules.xml'),
          MODERN_RULES,
        ),
      ]);
      return modConfig;
    },
  ]);

  return next;
};

module.exports = withNoDataRestore;
