/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

const DEVICE_ID_KEY = 'openshare_device_id';

/**
 * Returns or generates a persistent unique device ID for the current browser profile.
 */
export function getOrCreateDeviceId(): string {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id || id.trim().length === 0) {
    id = 'dev_' + Math.random().toString(36).slice(2, 10) + '_' + Date.now().toString(36);
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}
