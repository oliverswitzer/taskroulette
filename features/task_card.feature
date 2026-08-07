Feature: Completing the selected task
  As a user who just had the wheel pick a task for me
  I want to either mark it done or skip back to the wheel
  So that I feel rewarded for starting and stay in control if the wheel picked wrong

  Background:
    Given the wheel has landed on the task "Call dentist"
    And I am on the TASK_CARD screen for "Call dentist"

  Scenario: Checking off a task removes it and returns to the wheel
    Given more than 1 active task remains
    When I tap the task checkbox
    Then "Call dentist" is marked completed
    And the completed task count increases by 1
    And I am returned to the WHEEL_IDLE screen
    And "Call dentist" no longer appears on the wheel

  Scenario: Checking off the second-to-last task auto-shows the final task
    Given exactly 2 active tasks remain including "Call dentist"
    When I tap the task checkbox
    Then I am taken directly to the TASK_CARD screen for the one remaining task
    And the wheel is not shown in between

  Scenario: Checking off the very last task shows the celebration screen
    Given "Call dentist" is the only remaining active task
    When I tap the task checkbox
    Then a confetti celebration plays
    And I am taken to the ALL_DONE screen
    And the session completion is recorded

  Scenario: Skipping a task returns to the wheel without completing it
    When I tap the skip control
    Then "Call dentist" is not marked completed
    And I am returned to the WHEEL_IDLE screen
    And "Call dentist" still appears on the wheel

  Scenario: Skip and spin again immediately re-spins the wheel
    When I tap "spin again" from the task card
    Then the wheel auto-spins without requiring a second tap
    And a new task card appears once the auto-spin completes

  Scenario: Backing out to the dump screen from the task card
    When I tap the back-to-dump control from the task card
    Then I am returned to the DUMP screen
    And the current task selection is cleared
