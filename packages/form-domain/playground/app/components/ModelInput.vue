<script setup lang="ts">
/**
 * Deliberately written the way a project's own input is: `defineModel<string>()`
 * plus optional props. That is what makes it a fixture — `defineModel` without
 * `required` widens the emitted value to `string | undefined`, and `register()`
 * has to stay assignable to that.
 */
defineProps<{
  name: string
  label?: string
}>()

const model = defineModel<string>()
</script>

<template>
  <label>
    {{ label }}
    <input
      :name="name"
      :value="model"
      @input="model = ($event.target as HTMLInputElement).value"
    >
  </label>
</template>
