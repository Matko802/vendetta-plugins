import { ReactNative } from "@vendetta/metro/common";
import { Forms } from "@vendetta/ui/components";
import { getAssetIDByName } from "@vendetta/ui/assets";
import { storage } from "@vendetta/plugin";
import { useProxy } from "@vendetta/storage";

const { FormIcon, FormSwitchRow } = Forms;

// Default values if not set
storage.nopk ??= false;
storage.logEdits ??= true;

export default () => {
  useProxy(storage);

  return (
    <ReactNative.ScrollView>
      <FormSwitchRow
        label="Ignore PluralKit"
        subLabel="Skips logging deletions from PluralKit proxy messages"
        leading={<FormIcon source={getAssetIDByName("ic_block")} />}
        onValueChange={(v) => void (storage.nopk = v)}
        value={storage.nopk}
      />

      <FormSwitchRow
        label="Enable Edit Logging"
        subLabel="Logs original message content before edits"
        leading={<FormIcon source={getAssetIDByName("ic_edit_24px")} />}
        onValueChange={(v) => void (storage.logEdits = v)}
        value={storage.logEdits}
      />
    </ReactNative.ScrollView>
  );
};
