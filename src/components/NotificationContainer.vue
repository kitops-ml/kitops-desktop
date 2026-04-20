<script setup lang="ts">
import IconAlert from '~icons/ri/alert-line'
import IconCheck from '~icons/ri/check-line'
import IconClose from '~icons/ri/close-line'
import IconErrorWarning from '~icons/ri/error-warning-line'
import IconInfo from '~icons/ri/information-line'

import { useNotification } from '../composables/useNotification'

const { notifications, remove } = useNotification()
</script>

<template>
  <Teleport to="body">
    <div class="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      <TransitionGroup name="notification">
        <div
          v-for="notification in notifications"
          :key="notification.id"
          class="pointer-events-auto flex items-start gap-3 bg-surface border border-gray-03 border-l-2 px-4 py-3 w-80 shadow-lg"
          :class="{
            'border-l-success': notification.type === 'success',
            'border-l-error': notification.type === 'error',
            'border-l-info': notification.type === 'info',
            'border-l-warning': notification.type === 'warning',
          }">
          <IconCheck v-if="notification.type === 'success'" class="size-4.5 mt-px shrink-0 text-success" />
          <IconErrorWarning v-else-if="notification.type === 'error'" class="size-4.5 mt-px shrink-0 text-error" />
          <IconAlert v-else-if="notification.type === 'warning'" class="size-4.5 mt-px shrink-0 text-warning" />
          <IconInfo v-else class="size-4.5 mt-px shrink-0 text-info" />
          <p class="flex-1 text-sm text-off-white leading-snug">{{ notification.message }}</p>
          <button
            class="text-gray-02 hover:text-off-white transition-colors shrink-0 mt-px"
            @click="remove(notification.id)">
            <IconClose class="size-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.notification-enter-active,
.notification-leave-active {
  transition: opacity 200ms ease, transform 200ms ease;
}

.notification-enter-from,
.notification-leave-to {
  opacity: 0;
  transform: translateX(1rem);
}

.notification-move {
  transition: transform 200ms ease;
}
</style>
