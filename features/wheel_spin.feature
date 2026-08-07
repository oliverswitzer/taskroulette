Feature: Spinning the prize wheel
  As a user who is stuck on what to do next
  I want a physical-feeling prize wheel to pick my next task for me
  So that decision fatigue is removed and starting feels like a small win

  Background:
    Given I am on the WHEEL_IDLE screen with the following tasks on the wheel:
      | task           |
      | Call dentist   |
      | Buy groceries  |
      | Email Sarah    |

  Scenario: The wheel renders one slice per active task
    Then the wheel has 3 slices
    And each slice shows a truncated task label

  Scenario: The wheel renders correctly at the maximum task count
    Given the wheel has 15 tasks loaded
    Then the wheel has 15 slices
    And the wheel remains visually legible

  Scenario: Tapping spin starts the wheel spinning
    When I tap the spin button
    Then the wheel enters the WHEEL_SPINNING state
    And the spin button becomes disabled while spinning

  Scenario: A swipe gesture spins the wheel with velocity proportional to the swipe
    When I swipe the wheel with a fast flick
    Then the wheel starts spinning with a high initial velocity
    When I swipe the wheel with a slow flick
    Then the wheel starts spinning with a low initial velocity

  Scenario: Swipes are never allowed to spin the wheel counter-clockwise
    When I swipe the wheel in the counter-clockwise direction
    Then the wheel's velocity is clamped to a non-negative value

  Scenario: A spin always comes to a stop within the hard time cap
    When I tap the spin button
    Then the wheel stops spinning within 5.5 seconds
    And a winning task is selected

  Scenario: A completed spin transitions to the task card
    When I tap the spin button
    And the wheel finishes spinning
    Then I am taken to the TASK_CARD screen
    And the task card shows the task the wheel landed on

  Scenario: Only one active task skips the wheel entirely
    Given the task list has exactly 1 active task
    Then I am taken directly to the TASK_CARD screen for that task
    And the wheel is never shown

  Scenario: Opening the edit modal from the wheel
    When I tap the edit tasks button
    Then the edit modal opens
    And I can add, edit, or delete tasks without leaving the wheel screen

  Scenario: Closing the edit modal returns to the wheel unchanged
    Given the edit modal is open
    When I tap "Done"
    Then the edit modal closes
    And I am still on the WHEEL_IDLE screen

  Scenario: Navigating back to the dump screen from the wheel
    When I tap the back-to-dump control
    Then I am returned to the DUMP screen

  Scenario Outline: prefers-reduced-motion is respected on the wheel
    Given the OS "reduce motion" accessibility setting is <setting>
    When I tap the spin button
    Then the wheel animation <behavior>

    Examples:
      | setting  | behavior                                |
      | enabled  | crossfades or jumps instantly to the winner |
      | disabled | animates the full spin as normal        |
