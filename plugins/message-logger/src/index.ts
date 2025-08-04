import { findByName, findByProps } from "@vendetta/metro";
import { FluxDispatcher, ReactNative } from "@vendetta/metro/common";
import { after, before, instead } from "@vendetta/patcher";

const patches = [];
const ChannelMessages = findByProps("_channelMessages");
const MessageRecordUtils = findByProps("updateMessageRecord", "createMessageRecord");
const MessageRecord = findByName("MessageRecord", false);
const RowManager = findByName("RowManager");

import { storage } from "@vendetta/plugin";

// Ensure default config
storage.nopk ??= false;
storage.logEdits ??= true;

// Handle deletions
patches.push(before("dispatch", FluxDispatcher, ([event]) => {
  if (event.type === "MESSAGE_DELETE") {
    if (event.__vml_cleanup) return event;

    const channel = ChannelMessages.get(event.channelId);
    const message = channel?.get(event.id);
    if (!message) return event;

    if (message.author?.id == "1") return event;
    if (message.state == "SEND_FAILED") return event;

    storage.nopk && fetch(`https://api.pluralkit.me/v2/messages/${encodeURIComponent(message.id)}`)
      .then((res) => res.json())
      .then((data) => {
        if (message.id === data.original && !data.member?.keep_proxy) {
          FluxDispatcher.dispatch({
            type: "MESSAGE_DELETE",
            id: message.id,
            channelId: message.channel_id,
            __vml_cleanup: true,
          });
        }
      });

    return [{
      message: {
        ...message.toJS(),
        __vml_deleted: true,
      },
      type: "MESSAGE_UPDATE",
    }];
  }
}));

// Handle edits with toggle
patches.push(before("dispatch", FluxDispatcher, ([event]) => {
  if (
    event.type === "MESSAGE_UPDATE" &&
    event.message?.id &&
    event.message?.content &&
    storage.logEdits
  ) {
    const channel = ChannelMessages.get(event.message.channel_id);
    const original = channel?.get(event.message.id);
    if (!original) return;

    if (original.content === event.message.content || event.message.__vml_edits) return;

    event.message.__vml_edits = {
      original: original.content,
    };
  }
}));

// Visual handling of deleted and edited messages
patches.push(after("generate", RowManager.prototype, ([data], row) => {
  if (data.rowType !== 1) return;

  const msg = data.message;

  // Deleted message highlight
  if (msg.__vml_deleted) {
    row.message.edited = "deleted";
    row.backgroundHighlight ??= {};
    row.backgroundHighlight.backgroundColor = ReactNative.processColor("#da373c22");
    row.backgroundHighlight.gutterColor = ReactNative.processColor("#da373cff");
  }

  // Edited message with original logged
  if (msg.__vml_edits?.original && row?.content?.props?.children && storage.logEdits) {
    const originalText = {
      type: "Text",
      props: {
        style: {
          color: "#eab308", // yellow
          fontStyle: "italic",
          marginBottom: 4,
        },
        children: `[Before Edit]: ${msg.__vml_edits.original}`,
      },
    };

    const children = Array.isArray(row.content.props.children)
      ? row.content.props.children
      : [row.content.props.children];

    row.content.props.children = [originalText, ...children];
  }
}));

// Preserve flags in records
patches.push(instead("updateMessageRecord", MessageRecordUtils, function ([oldRecord, newRecord], orig) {
  if (newRecord.__vml_deleted) {
    return MessageRecordUtils.createMessageRecord(newRecord, oldRecord.reactions);
  }
  return orig.apply(this, [oldRecord, newRecord]);
}));

patches.push(after("createMessageRecord", MessageRecordUtils, function ([message], record) {
  record.__vml_deleted = message.__vml_deleted;
  record.__vml_edits = message.__vml_edits;
}));

patches.push(after("default", MessageRecord, ([props], record) => {
  record.__vml_deleted = !!props.__vml_deleted;
  record.__vml_edits = props.__vml_edits;
}));

// Cleanup
export const onUnload = () => {
  patches.forEach((unpatch) => unpatch());

  for (const channelId in ChannelMessages._channelMessages) {
    for (const message of ChannelMessages._channelMessages[channelId]._array) {
      if (message.__vml_deleted) {
        FluxDispatcher.dispatch({
          type: "MESSAGE_DELETE",
          id: message.id,
          channelId: message.channel_id,
          __vml_cleanup: true,
        });
      }
    }
  }
};

export { default as settings } from "./settings";