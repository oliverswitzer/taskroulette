Feature: All tasks done celebration
  As a user who cleared their whole task list
  I want a celebratory ending that reflects how many tasks I completed
  So that finishing feels rewarding, not anticlimactic

  Background:
    Given I have completed all tasks in my list
    And I am on the ALL_DONE screen

  Scenario: The all-done screen shows the completed task count
    Given I completed 4 tasks this session
    Then the ALL_DONE screen shows "4" as the completed count
    And a motivational message referencing the count is shown

  Scenario: Motivational message wording varies but always includes the count
    Given I completed 7 tasks this session
    Then the motivational message shown contains the number 7

  Scenario: Starting fresh clears all state and returns to the dump screen
    When I tap "Start fresh"
    Then all tasks are cleared
    And the completed task count resets to 0
    And any selected task is cleared
    And I am returned to the DUMP screen

  Scenario: A confetti explosion plays when the last task is completed
    Given the last task in the list was just checked off
    Then 8 directional confetti bursts fire, one per wheel color
    And a central confetti burst fires after the directional bursts
